package com.amigoinvisible.dto;

import java.util.List;

/** Todo lo que ve la organización de un sorteo. */
public record AdminStateDto(EventInfoDto event, List<AdminParticipantDto> participants) {
}
