package com.hackathon.summer.faf.domain.model

// Outcome of an atomic booking attempt at the persistence boundary.
enum class BookingOutcome {
    BOOKED,
    ACTIVITY_NOT_FOUND,
    ACTIVITY_FULL,
    ALREADY_BOOKED
}

// Outcome of an atomic cancellation attempt at the persistence boundary.
enum class CancellationOutcome {
    CANCELLED,
    ACTIVITY_NOT_FOUND,
    NOT_BOOKED
}
