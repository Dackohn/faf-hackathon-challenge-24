package com.hackathon.summer.faf.application.usecase

import com.hackathon.summer.faf.application.result.CancelActivityResult
import com.hackathon.summer.faf.domain.model.CancellationOutcome
import com.hackathon.summer.faf.domain.repository.ActivityRepository


class CancelActivityUseCase(
    private val activityRepository: ActivityRepository
) {

    fun execute(activityId: String, visitorId: String): CancelActivityResult {

        return when (activityRepository.cancel(activityId, visitorId)) {
            CancellationOutcome.CANCELLED -> CancelActivityResult.CANCELLED
            CancellationOutcome.ACTIVITY_NOT_FOUND -> CancelActivityResult.ACTIVITY_NOT_FOUND
            CancellationOutcome.NOT_BOOKED -> CancelActivityResult.NOT_BOOKED
        }
    }
}
