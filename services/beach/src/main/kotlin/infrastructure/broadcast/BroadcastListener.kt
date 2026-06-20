package com.hackathon.summer.faf.infrastructure.broadcast

import com.hackathon.summer.faf.domain.repository.VisitorRepository
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.slf4j.LoggerFactory
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

private val log = LoggerFactory.getLogger("BroadcastListener")

private val json = Json { ignoreUnknownKeys = true }

// Connects to the broadcast SSE stream and upserts visitors into the beach
// visitors table whenever a hotel.reservation_confirmed event arrives, so the
// check-in gate reflects real hotel state without polling.
class BroadcastListener(
    private val broadcastUrl: String,
    private val visitorRepository: VisitorRepository,
    private val serviceToken: String? = null
) {

    private val http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build()

    fun startInBackground(): Thread {
        val thread = Thread(::runLoop, "broadcast-listener")
        thread.isDaemon = true
        thread.start()
        return thread
    }

    private fun runLoop() {
        while (!Thread.currentThread().isInterrupted) {
            try {
                connect()
            } catch (e: InterruptedException) {
                break
            } catch (e: Exception) {
                log.warn("Broadcast SSE disconnected ({}), reconnecting in 5s", e.message)
                Thread.sleep(5_000)
            }
        }
    }

    private fun connect() {
        val builder = HttpRequest.newBuilder()
            .uri(URI.create("$broadcastUrl/events/"))
            .header("Accept", "text/event-stream")

        if (!serviceToken.isNullOrBlank()) {
            builder.header("X-Service-Token", serviceToken)
        }

        val request = builder.GET().build()

        val body = http.send(request, HttpResponse.BodyHandlers.ofLines())

        body.body().use { lines ->
            var dataLine: String? = null
            lines.forEach { line ->
                when {
                    line.startsWith("data:") -> dataLine = line.removePrefix("data:").trim()
                    line.isEmpty() -> {
                        dataLine?.let { handleEvent(it) }
                        dataLine = null
                    }
                }
            }
        }
    }

    private fun handleEvent(rawData: String) {
        try {
            val obj = json.parseToJsonElement(rawData).jsonObject
            val eventType = obj["event_type"]?.jsonPrimitive?.content ?: return

            if (eventType == "hotel.reservation_confirmed") {
                val guestId = obj["guest_id"]?.jsonPrimitive?.content ?: return
                visitorRepository.upsert(guestId, checkedIn = true)
                log.info("Visitor {} marked as checked-in via broadcast", guestId)
            }
        } catch (e: Exception) {
            log.warn("Failed to parse broadcast event: {}", e.message)
        }
    }
}
