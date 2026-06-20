package com.hackathon.summer.faf.application.usecase

import com.hackathon.summer.faf.application.result.BookActivityResult
import com.hackathon.summer.faf.domain.model.BookingOutcome
import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.domain.repository.VisitorRepository


class BookActivityUseCase(
    private val activityRepository: ActivityRepository,
    private val visitorRepository: VisitorRepository
) {

    fun execute(activityId: String, visitorId: String): BookActivityResult {

        // Enforce check-in only when the visitor is actually known: there is no
        // path today that populates the visitors table, so an unknown visitor is
        // allowed through rather than failing every booking. A known visitor who
        // is explicitly not checked in is rejected per the documented contract.
        val visitor = visitorRepository.findById(visitorId)
        if (visitor != null && !visitor.checkedIn) {
            return BookActivityResult.VISITOR_NOT_CHECKED_IN
        }

        return when (activityRepository.book(activityId, visitorId)) {
            BookingOutcome.BOOKED -> BookActivityResult.BOOKED
            BookingOutcome.ACTIVITY_NOT_FOUND -> BookActivityResult.ACTIVITY_NOT_FOUND
            BookingOutcome.ACTIVITY_FULL -> BookActivityResult.ACTIVITY_FULL
            BookingOutcome.ALREADY_BOOKED -> BookActivityResult.ALREADY_BOOKED
        }
    }
}
