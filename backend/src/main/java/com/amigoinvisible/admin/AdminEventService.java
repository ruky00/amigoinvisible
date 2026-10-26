package com.amigoinvisible.admin;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amigoinvisible.common.ApiException;
import com.amigoinvisible.common.Ids;
import com.amigoinvisible.domain.DrawEvent;
import com.amigoinvisible.domain.DrawEventRepository;
import com.amigoinvisible.domain.Participant;
import com.amigoinvisible.dto.AdminStateDto;
import com.amigoinvisible.dto.Dtos;
import com.amigoinvisible.dto.EventDraftRequest;
import com.amigoinvisible.dto.EventSummaryDto;
import com.amigoinvisible.dto.IdResponse;
import com.amigoinvisible.dto.UpdateParticipantRequest;

/**
 * Lo que hace la organización con sus sorteos y con la gente de cada uno.
 * Los mensajes de error son los mismos que los del mock del front (src/api/mock.ts).
 */
@Service
public class AdminEventService {

    static final String EVENT_NOT_FOUND = "Ese sorteo ya no existe.";
    static final String PARTICIPANT_NOT_FOUND = "Esa persona ya no está en la lista.";

    private final DrawEventRepository events;
    private final ParticipantCodeGenerator codes;
    private final Clock clock;

    public AdminEventService(DrawEventRepository events, ParticipantCodeGenerator codes, Clock clock) {
        this.events = events;
        this.codes = codes;
        this.clock = clock;
    }

    // --- Sorteos ---

    @Transactional(readOnly = true)
    public List<EventSummaryDto> listEvents() {
        return events.findAllByOrderByCreatedAtDesc().stream().map(Dtos::eventSummary).toList();
    }

    @Transactional
    public IdResponse createEvent(EventDraftRequest draft) {
        return new IdResponse(createEvent(draft, clock.instant()).getId());
    }

    /** Variante con fecha de creación explícita (los datos de ejemplo la necesitan para ordenar). */
    @Transactional
    public DrawEvent createEvent(EventDraftRequest draft, Instant createdAt) {
        CleanDraft clean = clean(draft);
        return events.save(new DrawEvent(Ids.newId(), clean.name(), clean.budget(), clean.date(), createdAt));
    }

    @Transactional(readOnly = true)
    public AdminStateDto getState(String eventId) {
        return Dtos.adminState(requireEvent(eventId));
    }

    @Transactional
    public AdminStateDto updateEvent(String eventId, EventDraftRequest draft) {
        DrawEvent event = requireEvent(eventId);
        CleanDraft clean = clean(draft);
        event.setName(clean.name());
        event.setBudget(clean.budget());
        event.setExchangeDate(clean.date());
        return Dtos.adminState(event);
    }

    /** Borra en cascada participantes, exclusiones, deseos y parejas; las sesiones caen por la BD. */
    @Transactional
    public void deleteEvent(String eventId) {
        events.delete(requireEvent(eventId));
    }

    // --- Participantes ---

    @Transactional
    public AdminStateDto addParticipant(String eventId, String rawName) {
        DrawEvent event = requireEvent(eventId);
        if (event.isDrawn()) {
            throw ApiException.badRequest("El sorteo ya está hecho. Anúlalo para añadir a alguien.");
        }
        String name = participantName(rawName);
        if (name.isEmpty()) {
            throw ApiException.badRequest("Escribe un nombre.");
        }
        requireFreeName(event, name, null);
        addParticipant(event, name, codes.newCode());
        return Dtos.adminState(event);
    }

    /**
     * Añade sin más comprobaciones (los datos de ejemplo traen códigos fijos).
     * La hora de alta va siempre después de la del anterior, para que el orden de la lista sea estable.
     */
    @Transactional
    public Participant addParticipant(DrawEvent event, String name, String code) {
        Instant now = clock.instant();
        List<Participant> people = event.getParticipants();
        if (!people.isEmpty()) {
            Instant last = people.get(people.size() - 1).getCreatedAt();
            if (!now.isAfter(last)) {
                now = last.plusMillis(1);
            }
        }
        Participant p = new Participant(Ids.newId(), event, name, code, now);
        event.addParticipant(p);
        return p;
    }

    @Transactional
    public AdminStateDto updateParticipant(String eventId, String participantId, UpdateParticipantRequest data) {
        DrawEvent event = requireEvent(eventId);
        Participant p = requireParticipant(event, participantId);

        if (data.name() != null) {
            String name = participantName(data.name());
            // como en el mock: un nombre en blanco deja el que había
            if (!name.isEmpty()) {
                requireFreeName(event, name, p);
                p.setName(name);
            }
        }

        if (data.exclusions() != null) {
            Set<String> inEvent = event.getParticipants().stream().map(Participant::getId).collect(Collectors.toSet());
            Set<String> clean = new LinkedHashSet<>();
            for (String id : data.exclusions()) {
                if (id == null || id.equals(p.getId())) {
                    continue;
                }
                if (!inEvent.contains(id)) {
                    throw ApiException.badRequest("Esa persona no está en este sorteo.");
                }
                clean.add(id);
            }
            p.getExclusionIds().clear();
            p.getExclusionIds().addAll(clean);
        }
        return Dtos.adminState(event);
    }

    @Transactional
    public AdminStateDto removeParticipant(String eventId, String participantId) {
        DrawEvent event = requireEvent(eventId);
        if (event.isDrawn()) {
            throw ApiException.badRequest("El sorteo ya está hecho. Anúlalo para quitar a alguien.");
        }
        Participant p = requireParticipant(event, participantId);
        event.removeParticipant(p);
        for (Participant other : event.getParticipants()) {
            other.getExclusionIds().remove(participantId);
        }
        return Dtos.adminState(event);
    }

    // --- Ayudantes ---

    /** El sorteo o 404. Pensado para usarse dentro de la transacción de quien llama. */
    @Transactional(readOnly = true)
    public DrawEvent requireEvent(String eventId) {
        return events.findById(eventId).orElseThrow(() -> ApiException.notFound(EVENT_NOT_FOUND));
    }

    private static Participant requireParticipant(DrawEvent event, String participantId) {
        return event.getParticipants().stream()
                .filter(x -> x.getId().equals(participantId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound(PARTICIPANT_NOT_FOUND));
    }

    /** Recorta y comprueba la longitud; el vacío lo decide cada caso (añadir falla, editar lo ignora). */
    private static String participantName(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.length() > Participant.NAME_MAX) {
            throw ApiException.badRequest("El nombre es demasiado largo (máximo " + Participant.NAME_MAX + " letras).");
        }
        return name;
    }

    /** Nombres únicos dentro del sorteo sin distinguir mayúsculas ("luna" choca con "Luna"). */
    private static void requireFreeName(DrawEvent event, String name, Participant self) {
        String wanted = name.toLowerCase(Locale.ROOT);
        boolean taken = event.getParticipants().stream()
                .filter(x -> x != self)
                .anyMatch(x -> x.getName().toLowerCase(Locale.ROOT).equals(wanted));
        if (taken) {
            throw ApiException.badRequest("Ya hay alguien llamado " + name + " en este sorteo.");
        }
    }

    private record CleanDraft(String name, String budget, LocalDate date) {
    }

    private static CleanDraft clean(EventDraftRequest draft) {
        String name = draft.name() == null ? "" : draft.name().trim();
        if (name.isEmpty()) {
            throw ApiException.badRequest("Ponle un nombre al sorteo.");
        }
        if (name.length() > DrawEvent.NAME_MAX) {
            throw ApiException.badRequest(
                    "El nombre del sorteo es demasiado largo (máximo " + DrawEvent.NAME_MAX + " letras).");
        }
        String budget = draft.budget() == null ? "" : draft.budget().trim();
        if (budget.length() > DrawEvent.BUDGET_MAX) {
            throw ApiException.badRequest(
                    "El presupuesto es demasiado largo (máximo " + DrawEvent.BUDGET_MAX + " letras).");
        }
        return new CleanDraft(name, budget, date(draft.date()));
    }

    /** "" o null = sin fecha; si no, YYYY-MM-DD. */
    private static LocalDate date(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("La fecha no es válida.");
        }
    }
}
