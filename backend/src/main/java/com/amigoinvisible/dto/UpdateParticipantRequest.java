package com.amigoinvisible.dto;

import java.util.List;

/** PATCH .../participants/:id. Los campos que lleguen null no se tocan. */
public record UpdateParticipantRequest(String name, List<String> exclusions) {
}
