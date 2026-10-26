# syntax=docker/dockerfile:1

# ---------- 1) Compilar ----------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

# Primero solo lo necesario para descargar dependencias: si no cambia el pom.xml,
# Docker reutiliza esta capa y no vuelve a bajar medio Internet.
COPY mvnw pom.xml ./
COPY .mvn .mvn
# Por si mvnw llega con finales de línea de Windows (CRLF)
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
RUN ./mvnw -B -q dependency:go-offline

COPY src src
RUN ./mvnw -B -DskipTests package \
 && cp target/*.jar app.jar

# ---------- 2) Ejecutar ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

# Usuario sin privilegios
RUN groupadd --system app && useradd --system --gid app --no-create-home app

COPY --from=build /workspace/app.jar app.jar
USER app

ENV SPRING_PROFILES_ACTIVE=postgres
EXPOSE 8080

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
