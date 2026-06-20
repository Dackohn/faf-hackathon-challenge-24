package com.hackathon.summer.faf.infrastructure.broadcast

import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

class BroadcastClient(private val baseUrl: String) {

    private val http = HttpClient.newHttpClient()

    fun notifyActivityStatus(
        activityId: String,
        activityName: String,
        remaining: Int,
        isFull: Boolean
    ) {
        val path = if (isFull) "full" else "available"
        val body = """{"message":"Activity $activityName is ${if (isFull) "full" else "available"}","sender":"beach","data":{"activity_id":"$activityId","activity_name":"$activityName","remaining":$remaining}}"""

        val request = HttpRequest.newBuilder()
            .uri(URI.create("$baseUrl/beach/$path"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build()

        http.sendAsync(request, HttpResponse.BodyHandlers.discarding())
            .exceptionally { null }
    }
}
