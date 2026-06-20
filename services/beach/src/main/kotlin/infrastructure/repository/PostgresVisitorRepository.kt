package com.hackathon.summer.faf.infrastructure.repository

import com.hackathon.summer.faf.domain.model.Visitor
import com.hackathon.summer.faf.domain.repository.VisitorRepository
import com.hackathon.summer.faf.infrastructure.database.table.VisitorsTable
import org.jetbrains.exposed.sql.select
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.upsert

class PostgresVisitorRepository : VisitorRepository {

    override fun findById(id: String): Visitor? {
        return transaction {
            VisitorsTable
                .select { VisitorsTable.id eq id }
                .map { Visitor(id = it[VisitorsTable.id], checkedIn = it[VisitorsTable.checkedIn]) }
                .singleOrNull()
        }
    }

    override fun upsert(id: String, checkedIn: Boolean) {
        transaction {
            VisitorsTable.upsert {
                it[VisitorsTable.id] = id
                it[VisitorsTable.checkedIn] = checkedIn
            }
        }
    }
}