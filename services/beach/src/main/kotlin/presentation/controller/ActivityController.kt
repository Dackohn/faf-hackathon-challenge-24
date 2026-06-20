package com.hackathon.summer.faf.presentation.controller


import com.hackathon.summer.faf.application.result.BookActivityResult
import com.hackathon.summer.faf.application.result.CancelActivityResult
import com.hackathon.summer.faf.application.usecase.BookActivityUseCase
import com.hackathon.summer.faf.application.usecase.CancelActivityUseCase
import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.infrastructure.broadcast.BroadcastClient
import com.hackathon.summer.faf.presentation.request.CreateActivityRequest
import com.hackathon.summer.faf.presentation.request.VisitorRequest
import com.hackathon.summer.faf.presentation.response.ActivityDetailResponse
import com.hackathon.summer.faf.presentation.response.ActivityResponse
import com.hackathon.summer.faf.presentation.response.ErrorResponse
import domain.error.ActivityErrors
import domain.error.VisitorErrors
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*


class ActivityController(
    private val activityRepository: ActivityRepository,
    private val bookActivityUseCase: BookActivityUseCase,
    private val cancelActivityUseCase: CancelActivityUseCase,
    private val broadcastClient: BroadcastClient? = null,
    private val adminPasscode: String? = null
) {

    private fun notifyActivityStatus(activityId: String) {
        val client = broadcastClient ?: return
        val activity = activityRepository.findById(activityId) ?: return
        client.notifyActivityStatus(activity.id, activity.name, activity.remaining(), activity.isFull())
    }

    suspend fun getActivitiesDetail(call: ApplicationCall) {
        if (!isAdminAuthorized(call)) return

        val activities = activityRepository.findAll()
        val response = activities.map { activity ->
            ActivityDetailResponse(
                activity_id = activity.id,
                activity_name = activity.name,
                description = activity.description,
                capacity = activity.capacity,
                remaining = activity.remaining(),
                visitors = activity.bookedVisitors.toList()
            )
        }
        call.respond(HttpStatusCode.OK, mapOf("activities" to response))
    }

    suspend fun createActivity(call: ApplicationCall) {
        if (!isAdminAuthorized(call)) return

        val body = try {
            call.receive<CreateActivityRequest>()
        } catch (e: Exception) {
            call.respond(HttpStatusCode.BadRequest, ErrorResponse("Invalid request body"))
            return
        }

        if (body.activity_id.isBlank() || body.activity_name.isBlank() || body.capacity <= 0) {
            call.respond(HttpStatusCode.BadRequest, ErrorResponse("activity_id, activity_name and capacity are required"))
            return
        }

        val activity = activityRepository.create(
            id = body.activity_id,
            name = body.activity_name,
            description = body.description,
            capacity = body.capacity
        )

        call.respond(
            HttpStatusCode.Created,
            ActivityResponse(
                activity_id = activity.id,
                activity_name = activity.name,
                description = activity.description,
                capacity = activity.capacity,
                remaining = activity.remaining()
            )
        )
    }

    suspend fun deleteActivity(call: ApplicationCall) {
        if (!isAdminAuthorized(call)) return

        val activityId = call.parameters["activity_id"]
        if (activityId.isNullOrBlank()) {
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(ActivityErrors.MISSING_ACTIVITY_ID))
            return
        }

        val deleted = activityRepository.delete(activityId)
        if (!deleted) {
            call.respond(HttpStatusCode.NotFound, ErrorResponse(ActivityErrors.ACTIVITY_NOT_FOUND))
            return
        }

        call.respond(HttpStatusCode.OK, mapOf("status" to "deleted"))
    }

    private suspend fun isAdminAuthorized(call: ApplicationCall): Boolean {
        if (adminPasscode.isNullOrBlank()) {
            call.respond(HttpStatusCode.ServiceUnavailable, ErrorResponse("Admin access not configured"))
            return false
        }
        val provided = call.request.headers["X-Admin-Passcode"]
        if (provided == null || provided != adminPasscode) {
            call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Unauthorized"))
            return false
        }
        return true
    }

    suspend fun book(call: ApplicationCall) {

        val activityId = call.parameters["activity_id"]
        if (activityId.isNullOrBlank()) {
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(ActivityErrors.MISSING_ACTIVITY_ID))
            return
        }

        val visitorId = readVisitorId(call) ?: return

        val result = bookActivityUseCase.execute(activityId, visitorId)

        when (result) {
            BookActivityResult.BOOKED -> {
                call.respond(HttpStatusCode.OK, mapOf("status" to "booked"))
                notifyActivityStatus(activityId)
            }

            BookActivityResult.ACTIVITY_NOT_FOUND ->
                call.respond(HttpStatusCode.NotFound, ErrorResponse(ActivityErrors.ACTIVITY_NOT_FOUND))

            BookActivityResult.ACTIVITY_FULL ->
                call.respond(HttpStatusCode.Conflict, ErrorResponse(ActivityErrors.ACTIVITY_FULL))

            BookActivityResult.ALREADY_BOOKED ->
                call.respond(HttpStatusCode.Conflict, ErrorResponse(ActivityErrors.ACTIVITY_ALREADY_BOOKED))

            BookActivityResult.VISITOR_NOT_CHECKED_IN ->
                call.respond(HttpStatusCode.Forbidden, ErrorResponse(VisitorErrors.VISITOR_NOT_CHECKED_IN))
        }
    }

    suspend fun cancel(call: ApplicationCall) {

        val activityId = call.parameters["activity_id"]
        if (activityId.isNullOrBlank()) {
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(ActivityErrors.MISSING_ACTIVITY_ID))
            return
        }

        val visitorId = readVisitorId(call) ?: return

        val result = cancelActivityUseCase.execute(activityId, visitorId)

        when (result) {
            CancelActivityResult.CANCELLED -> {
                call.respond(HttpStatusCode.OK, mapOf("status" to "cancelled"))
                notifyActivityStatus(activityId)
            }

            CancelActivityResult.ACTIVITY_NOT_FOUND ->
                call.respond(HttpStatusCode.NotFound, ErrorResponse(ActivityErrors.ACTIVITY_NOT_FOUND))

            CancelActivityResult.NOT_BOOKED ->
                call.respond(HttpStatusCode.Conflict, ErrorResponse(ActivityErrors.ACTIVITY_NOT_BOOKED))
        }
    }

    suspend fun getActivity(call: ApplicationCall) {

        val activityId = call.parameters["activity_id"]
        if (activityId.isNullOrBlank()) {
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(ActivityErrors.MISSING_ACTIVITY_ID))
            return
        }

        val activity = activityRepository.findById(activityId)
        if (activity == null) {
            call.respond(HttpStatusCode.NotFound, ErrorResponse(ActivityErrors.ACTIVITY_NOT_FOUND))
            return
        }

        call.respond(
            HttpStatusCode.OK,
            ActivityResponse(
                activity_id = activity.id,
                activity_name = activity.name,
                description = activity.description,
                capacity = activity.capacity,
                remaining = activity.remaining()
            )
        )
    }

    suspend fun getActivities(call: ApplicationCall) {

        val activities = activityRepository.findAll()

        val response = activities.map { activity ->

            ActivityResponse(
                activity_id = activity.id,
                activity_name = activity.name,
                description = activity.description,
                capacity = activity.capacity,
                remaining = activity.remaining()
            )
        }

        call.respond(
            HttpStatusCode.OK,
            mapOf("activities" to response)
        )
    }

    private suspend fun readVisitorId(call: ApplicationCall): String? {
        val request = try {
            call.receive<VisitorRequest>()
        } catch (e: Exception) {
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(VisitorErrors.VISITOR_MISSING_ID))
            return null
        }

        if (request.id.isBlank()) {
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(VisitorErrors.VISITOR_MISSING_ID))
            return null
        }

        return request.id
    }
}
