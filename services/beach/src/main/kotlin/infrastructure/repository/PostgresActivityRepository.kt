package com.hackathon.summer.faf.infrastructure.repository

import com.hackathon.summer.faf.domain.model.Activity
import com.hackathon.summer.faf.domain.model.BookingOutcome
import com.hackathon.summer.faf.domain.model.CancellationOutcome
import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.infrastructure.database.table.ActivityBookingsTable
import com.hackathon.summer.faf.infrastructure.database.table.ActivityTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.sql.Connection

class PostgresActivityRepository : ActivityRepository {

    override fun findAll(): List<Activity> {

        return transaction {

            // Load every booking once and group by activity to avoid an N+1 query.
            val bookedByActivity: Map<String, MutableSet<String>> =
                ActivityBookingsTable.selectAll()
                    .groupBy(
                        { it[ActivityBookingsTable.activityId] },
                        { it[ActivityBookingsTable.visitorId] }
                    )
                    .mapValues { (_, visitors) -> visitors.toMutableSet() }

            ActivityTable.selectAll().map {

                val activityId = it[ActivityTable.id]

                Activity(
                    id = activityId,
                    name = it[ActivityTable.name],
                    description = it[ActivityTable.description],
                    capacity = it[ActivityTable.capacity],
                    bookedVisitors = bookedByActivity[activityId] ?: mutableSetOf()
                )
            }
        }
    }

    override fun findById(id: String): Activity? {

        return transaction {

            val row = ActivityTable
                .select { ActivityTable.id eq id }
                .singleOrNull()
                ?: return@transaction null

            val bookedVisitors = ActivityBookingsTable
                .select { ActivityBookingsTable.activityId eq id }
                .map { it[ActivityBookingsTable.visitorId] }
                .toMutableSet()

            Activity(
                id = row[ActivityTable.id],
                name = row[ActivityTable.name],
                description = row[ActivityTable.description],
                capacity = row[ActivityTable.capacity],
                bookedVisitors = bookedVisitors
            )
        }
    }

    override fun book(activityId: String, visitorId: String): BookingOutcome {

        // READ COMMITTED + a row lock on the activity is the canonical fix for the
        // overbooking race: concurrent bookers serialize on the locked row, and
        // because each statement re-reads committed data, the loser sees the
        // winner's insert and is correctly rejected when the activity is full.
        return transaction(
            transactionIsolation = Connection.TRANSACTION_READ_COMMITTED,
            readOnly = false,
            db = null
        ) {

            val activity = ActivityTable
                .select { ActivityTable.id eq activityId }
                .forUpdate()
                .singleOrNull()
                ?: return@transaction BookingOutcome.ACTIVITY_NOT_FOUND

            val capacity = activity[ActivityTable.capacity]

            val alreadyBooked = ActivityBookingsTable
                .select {
                    (ActivityBookingsTable.activityId eq activityId) and
                        (ActivityBookingsTable.visitorId eq visitorId)
                }
                .count() > 0
            if (alreadyBooked) return@transaction BookingOutcome.ALREADY_BOOKED

            val booked = ActivityBookingsTable
                .select { ActivityBookingsTable.activityId eq activityId }
                .count()
            if (booked >= capacity) return@transaction BookingOutcome.ACTIVITY_FULL

            ActivityBookingsTable.insert {
                it[ActivityBookingsTable.activityId] = activityId
                it[ActivityBookingsTable.visitorId] = visitorId
            }

            BookingOutcome.BOOKED
        }
    }

    override fun cancel(activityId: String, visitorId: String): CancellationOutcome {

        return transaction(
            transactionIsolation = Connection.TRANSACTION_READ_COMMITTED,
            readOnly = false,
            db = null
        ) {

            val activityExists = ActivityTable
                .select { ActivityTable.id eq activityId }
                .count() > 0
            if (!activityExists) return@transaction CancellationOutcome.ACTIVITY_NOT_FOUND

            // Locals avoid shadowing the columns of the deleteWhere table receiver.
            val activityKey = activityId
            val visitorKey = visitorId
            val deleted = ActivityBookingsTable.deleteWhere {
                (ActivityBookingsTable.activityId eq activityKey) and
                    (ActivityBookingsTable.visitorId eq visitorKey)
            }

            if (deleted == 0) CancellationOutcome.NOT_BOOKED else CancellationOutcome.CANCELLED
        }
    }

    override fun create(id: String, name: String, description: String?, capacity: Int): Activity {
        return transaction {
            ActivityTable.insert {
                it[ActivityTable.id] = id
                it[ActivityTable.name] = name
                it[ActivityTable.description] = description
                it[ActivityTable.capacity] = capacity
            }
            Activity(id = id, name = name, description = description, capacity = capacity)
        }
    }

    override fun delete(id: String): Boolean {
        return transaction {
            val idKey = id
            ActivityBookingsTable.deleteWhere { ActivityBookingsTable.activityId eq idKey }
            ActivityTable.deleteWhere { ActivityTable.id eq idKey } > 0
        }
    }
}
