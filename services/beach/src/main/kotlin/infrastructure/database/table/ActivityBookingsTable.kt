package com.hackathon.summer.faf.infrastructure.database.table

import org.jetbrains.exposed.sql.Table

// Durable record of which visitor booked which activity. The composite primary
// key (activity_id, visitor_id) makes a booking idempotent and blocks duplicates
// at the database level, independent of any in-memory state.
object ActivityBookingsTable : Table("activity_bookings") {

    val activityId = varchar("activity_id", 50)

    val visitorId = varchar("visitor_id", 50)

    override val primaryKey = PrimaryKey(activityId, visitorId)
}
