package com.amigoinvisible.dto;

/** GET /api/me */
public record MeResponse(MeDto me, EventInfoDto event) {
}
