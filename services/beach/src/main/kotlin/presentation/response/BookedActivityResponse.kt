package com.hackathon.summer.faf.presentation.response

import kotlinx.serialization.Serializable

// Reports which activity a guest currently holds (null when they hold none).
@Serializable
data class BookedActivityResponse(
    val activity_id: String?
)
