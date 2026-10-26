package com.amigoinvisible.admin;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amigoinvisible.dto.AddParticipantRequest;
import com.amigoinvisible.dto.AdminStateDto;
import com.amigoinvisible.dto.EventDraftRequest;
import com.amigoinvisible.dto.EventsResponse;
import com.amigoinvisible.dto.IdResponse;
import com.amigoinvisible.dto.UpdateParticipantRequest;

/** Zona de organización (API.md, "Organización"). El token lo comprueba AdminAuthInterceptor. */
@RestController
@RequestMapping("/api/admin/events")
public class AdminEventController {

    private final AdminEventService events;
    private final AdminDrawService draws;

    public AdminEventController(AdminEventService events, AdminDrawService draws) {
        this.events = events;
        this.draws = draws;
    }

    @GetMapping
    EventsResponse list() {
        return new EventsResponse(events.listEvents());
    }

    @PostMapping
    IdResponse create(@RequestBody EventDraftRequest body) {
        return events.createEvent(body);
    }

    @DeleteMapping("/{eventId}")
    ResponseEntity<Void> delete(@PathVariable String eventId) {
        events.deleteEvent(eventId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{eventId}")
    AdminStateDto get(@PathVariable String eventId) {
        return events.getState(eventId);
    }

    @PatchMapping("/{eventId}")
    AdminStateDto update(@PathVariable String eventId, @RequestBody EventDraftRequest body) {
        return events.updateEvent(eventId, body);
    }

    @PostMapping("/{eventId}/participants")
    AdminStateDto addParticipant(@PathVariable String eventId, @RequestBody AddParticipantRequest body) {
        return events.addParticipant(eventId, body.name());
    }

    @PatchMapping("/{eventId}/participants/{id}")
    AdminStateDto updateParticipant(
            @PathVariable String eventId, @PathVariable String id, @RequestBody UpdateParticipantRequest body) {
        return events.updateParticipant(eventId, id, body);
    }

    @DeleteMapping("/{eventId}/participants/{id}")
    AdminStateDto removeParticipant(@PathVariable String eventId, @PathVariable String id) {
        return events.removeParticipant(eventId, id);
    }

    @PostMapping("/{eventId}/draw")
    AdminStateDto runDraw(@PathVariable String eventId) {
        return draws.runDraw(eventId);
    }

    @DeleteMapping("/{eventId}/draw")
    AdminStateDto resetDraw(@PathVariable String eventId) {
        return draws.resetDraw(eventId);
    }
}
