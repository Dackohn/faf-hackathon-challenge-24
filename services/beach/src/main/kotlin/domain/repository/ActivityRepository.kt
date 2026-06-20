package com.hackathon.summer.faf.domain.repository

import com.hackathon.summer.faf.domain.model.Activity
import com.hackathon.summer.faf.domain.model.BookingOutcome
import com.hackathon.summer.faf.domain.model.CancellationOutcome

interface ActivityRepository {

    fun findAll(): List<Activity>

    fun findById(id: String): Activity?

    // Atomically reserves one spot for the visitor, enforcing capacity and
    // duplicate rules inside a single transaction.
    fun book(activityId: String, visitorId: String): BookingOutcome

    // Atomically releases the visitor's booking.
    fun cancel(activityId: String, visitorId: String): CancellationOutcome
}
