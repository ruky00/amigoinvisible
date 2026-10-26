package com.amigoinvisible.admin;

import java.time.Clock;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amigoinvisible.common.ApiException;
import com.amigoinvisible.domain.DrawEvent;
import com.amigoinvisible.domain.Participant;
import com.amigoinvisible.draw.DrawAlgorithm;
import com.amigoinvisible.draw.DrawException;
import com.amigoinvisible.dto.AdminStateDto;
import com.amigoinvisible.dto.Dtos;

/** Hacer y anular el sorteo. Las parejas se quedan en el servidor: AdminState nunca las enseña. */
@Service
public class AdminDrawService {

    private final AdminEventService events;
    private final Clock clock;
    private final DrawAlgorithm algorithm = new DrawAlgorithm();

    public AdminDrawService(AdminEventService events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public AdminStateDto runDraw(String eventId) {
        DrawEvent event = events.requireEvent(eventId);
        try {
            applyDraw(event);
        } catch (DrawException e) {
            throw ApiException.badRequest(e.getMessage());
        }
        return Dtos.adminState(event);
    }

    /** Anula el sorteo: fuera parejas y "visto"; las listas de deseos se quedan. */
    @Transactional
    public AdminStateDto resetDraw(String eventId) {
        DrawEvent event = events.requireEvent(eventId);
        for (Participant p : event.getParticipants()) {
            p.setReceiverId(null);
            p.setSeenAt(null);
        }
        event.setDrawnAt(null);
        return Dtos.adminState(event);
    }

    /**
     * Reparte (o vuelve a repartir) las parejas. Lanza {@link DrawException} si no se puede;
     * como el reparto se calcula entero antes de tocar nada, un fallo no deja el sorteo a medias.
     */
    @Transactional
    public void applyDraw(DrawEvent event) {
        Map<String, String> pairs = algorithm.draw(event.getParticipants().stream()
                .map(p -> new DrawAlgorithm.Person(p.getId(), p.getExclusionIds()))
                .toList());
        for (Participant p : event.getParticipants()) {
            p.setReceiverId(pairs.get(p.getId()));
            // sorteo nuevo: nadie ha visto todavía a quién le toca
            p.setSeenAt(null);
        }
        event.setDrawnAt(clock.instant());
    }
}
