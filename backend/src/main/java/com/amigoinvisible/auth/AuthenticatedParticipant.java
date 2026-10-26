package com.amigoinvisible.auth;

/**
 * Participante que hace la petición, sacado de su token.
 * Basta con declararlo como parámetro de un método de controlador para exigir sesión de participante:
 * <pre>{@code @GetMapping("/api/me") MeResponse me(AuthenticatedParticipant who) { ... }}</pre>
 * Solo lleva ids: el servicio carga la entidad dentro de su transacción.
 */
public record AuthenticatedParticipant(String participantId) {
}
