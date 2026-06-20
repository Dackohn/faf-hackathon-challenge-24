package com.hackathon.summer.faf.infrastructure.database

import com.hackathon.summer.faf.infrastructure.database.table.ActivityTable
import org.jetbrains.exposed.sql.batchInsert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction

// Seeds the 20 island activities on startup when the table is empty, so a fresh
// or reset database always has the catalogue present (mirrors db/init/seed_activities.sql).
// Bookings are intentionally left untouched — only the activity catalogue is seeded.
object ActivitySeeder {

    private data class SeedActivity(
        val id: String,
        val name: String,
        val description: String,
        val capacity: Int
    )

    private val SEED = listOf(
        SeedActivity("ACT001", "Beach Volleyball", "Competitive beach volleyball tournament.", 20),
        SeedActivity("ACT002", "Surf Lessons", "Beginner-friendly surf training session.", 15),
        SeedActivity("ACT003", "Snorkeling Adventure", "Explore underwater marine life.", 12),
        SeedActivity("ACT004", "Sunrise Yoga", "Morning yoga on the beach.", 25),
        SeedActivity("ACT005", "Kayaking Tour", "Guided kayaking along the coastline.", 10),
        SeedActivity("ACT006", "Sandcastle Competition", "Build the ultimate sandcastle.", 30),
        SeedActivity("ACT007", "Beach Soccer", "Friendly soccer matches on the sand.", 22),
        SeedActivity("ACT008", "Scuba Diving", "Discover deeper ocean wonders.", 8),
        SeedActivity("ACT009", "Jet Ski Experience", "High-speed water adventure.", 1),
        SeedActivity("ACT010", "Beach Bonfire", "Evening gathering with music and snacks.", 40),
        SeedActivity("ACT011", "Fishing Excursion", "Learn fishing techniques with experts.", 10),
        SeedActivity("ACT012", "Paddle Boarding", "Relaxing paddle board session.", 14),
        SeedActivity("ACT013", "Nature Walk", "Guided tour of local flora and fauna.", 18),
        SeedActivity("ACT014", "Photography Workshop", "Capture stunning beach landscapes.", 16),
        SeedActivity("ACT015", "Treasure Hunt", "Family-friendly beach treasure hunt.", 25),
        SeedActivity("ACT016", "Cooking Class", "Learn to prepare local seafood dishes.", 12),
        SeedActivity("ACT017", "Sailing Basics", "Introduction to sailing techniques.", 10),
        SeedActivity("ACT018", "Beach Cleanup", "Community environmental activity.", 50),
        SeedActivity("ACT019", "Meditation Session", "Relaxing guided meditation by the sea.", 20),
        SeedActivity("ACT020", "Sunset Cruise", "Boat cruise during sunset hours.", 15)
    )

    fun seedIfEmpty() {
        transaction {
            if (ActivityTable.selectAll().count() > 0) return@transaction

            ActivityTable.batchInsert(SEED) { activity ->
                this[ActivityTable.id] = activity.id
                this[ActivityTable.name] = activity.name
                this[ActivityTable.description] = activity.description
                this[ActivityTable.capacity] = activity.capacity
            }
        }
    }
}
