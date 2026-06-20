# Ktor activity-booking service. The repo ships no gradle-wrapper.jar, so build with the
# official gradle image (8.7 matches gradle/wrapper/gradle-wrapper.properties) instead of ./gradlew.
FROM gradle:8.7-jdk21 AS build
WORKDIR /home/gradle/src
COPY --chown=gradle:gradle . .
RUN gradle buildFatJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
# The ktor plugin's buildFatJar task emits <rootProject.name>-all.jar → beach-all.jar.
COPY --from=build /home/gradle/src/build/libs/beach-all.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
