package com.hackathon.summer.faf.application.result

// Result of the cancel-activity use case, mapped to HTTP status codes in the
// controller per the documented error contract (README error table).
enum class CancelActivityResult {
    CANCELLED,
    ACTIVITY_NOT_FOUND,
    NOT_BOOKED
}
