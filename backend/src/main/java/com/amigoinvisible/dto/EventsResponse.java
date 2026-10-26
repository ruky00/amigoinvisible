package com.amigoinvisible.dto;

import java.util.List;

/** GET /api/admin/events */
public record EventsResponse(List<EventSummaryDto> events) {
}
