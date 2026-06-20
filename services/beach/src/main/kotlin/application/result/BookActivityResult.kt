package com.hackathon.summer.faf.application.result

// Result of the book-activity use case, mapped to HTTP status codes in the
// controller per the documented error contract (README error table).
enum class BookActivityResult {
    BOOKED,
    ACTIVITY_NOT_FOUND,
    ACTIVITY_FULL,
    ALREADY_BOOKED,
    VISITOR_NOT_CHECKED_IN
}
