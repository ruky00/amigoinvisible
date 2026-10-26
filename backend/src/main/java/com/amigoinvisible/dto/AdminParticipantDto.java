package com.amigoinvisible.dto;

import java.util.List;

/** Participante visto por la organización. NUNCA incluye a quién regala. seenAt es ISO-8601 o null. */
public record AdminParticipantDto(String id, String name, String code, List<String> exclusions, int wishCount, String seenAt) {
}
