package com.amigoinvisible.demo;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.amigoinvisible.admin.AdminDrawService;
import com.amigoinvisible.admin.AdminEventService;
import com.amigoinvisible.common.Ids;
import com.amigoinvisible.config.AppProperties;
import com.amigoinvisible.domain.DrawEvent;
import com.amigoinvisible.domain.DrawEventRepository;
import com.amigoinvisible.domain.Participant;
import com.amigoinvisible.domain.Wish;
import com.amigoinvisible.dto.EventDraftRequest;

/**
 * Carga los mismos sorteos de ejemplo que el mock del front (seed() en src/api/mock.ts), con
 * los mismos códigos: así NIEVE-42 (el de la portada) funciona nada más arrancar.
 * Solo si app.demo-data está activo y la base de datos no tiene ningún sorteo.
 */
@Component
public class DemoDataLoader implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataLoader.class);

    private final AppProperties props;
    private final DrawEventRepository eventsRepo;
    private final AdminEventService events;
    private final AdminDrawService draws;
    private final Clock clock;

    public DemoDataLoader(
            AppProperties props,
            DrawEventRepository eventsRepo,
            AdminEventService events,
            AdminDrawService draws,
            Clock clock) {
        this.props = props;
        this.eventsRepo = eventsRepo;
        this.events = events;
        this.draws = draws;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!props.demoData() || eventsRepo.count() > 0) {
            return;
        }
        Instant now = clock.instant();

        // La familia se crea un poco antes, para que "Mis sorteos" salga siempre en el mismo orden
        DrawEvent family = events.createEvent(
                new EventDraftRequest("Papá Noel · Familia", "25 €", "2026-12-24"), now.minus(Duration.ofMinutes(1)));
        events.addParticipant(family, "Luna", "NIEVE-42");
        events.addParticipant(family, "Carlos", "RENO-11");
        events.addParticipant(family, "Abuela Carmen", "TURRON-23");
        Participant paco = events.addParticipant(family, "Tío Paco", "ACEBO-35");
        events.addParticipant(family, "Marta", "ESTRELLA-47");
        paco.replaceWishes(List.of(
                new Wish(Ids.newId(), paco, 0, "Un buen jamón (o medio, no soy exigente)", null),
                new Wish(Ids.newId(), paco, 1, "Bufanda de lana gris", "https://example.com/bufanda")));
        // Se guardan antes de sortear: receiver_id apunta a otro participante y la BD exige que exista ya
        eventsRepo.flush();
        // ya sorteado, para poder ver el sobre nada más entrar
        draws.applyDraw(family);

        DrawEvent team = events.createEvent(
                new EventDraftRequest("Camisetas raras · Equipo", "15 €", "2026-12-19"), now);
        events.addParticipant(team, "Luna", "TRINEO-58");
        events.addParticipant(team, "Dani", "COMETA-62");
        events.addParticipant(team, "Irene", "VELA-74");
        events.addParticipant(team, "Rober", "BELEN-86");

        log.info("Datos de ejemplo cargados: 2 sorteos (entra con el código NIEVE-42).");
    }
}
