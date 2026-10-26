package com.amigoinvisible.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import com.amigoinvisible.auth.AuthService;
import com.amigoinvisible.common.Ids;
import com.amigoinvisible.domain.Participant;
import com.amigoinvisible.domain.ParticipantRepository;
import com.amigoinvisible.domain.Wish;
import com.jayway.jsonpath.JsonPath;

/** La zona de organización de punta a punta: HTTP, servicios y base de datos (H2). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminApiTest {

    private static final String CODE_PATTERN = "^[A-Z]+-\\d{2,3}$";

    @Autowired
    MockMvc mvc;

    @Autowired
    ParticipantRepository participants;

    @Autowired
    AuthService auth;

    @Autowired
    TransactionTemplate tx;

    private String token;

    @BeforeEach
    void login() throws Exception {
        token = adminToken();
    }

    // --- Login y protección ---

    @Test
    void loginWithRightPasswordGivesToken() throws Exception {
        mvc.perform(post("/api/admin/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"test-admin\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString());
    }

    @Test
    void loginWithWrongPasswordIs401() throws Exception {
        mvc.perform(post("/api/admin/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"turron\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Contraseña incorrecta."));
        mvc.perform(post("/api/admin/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void everyAdminEndpointNeedsAnAdminToken() throws Exception {
        String eventId = createEvent("Protegido", "", "");
        String pid = addParticipant(eventId, "Alguien");
        String participantToken = auth.openParticipantSession(pid);
        String base = "/api/admin/events/" + eventId;
        List<Supplier<MockHttpServletRequestBuilder>> calls = List.of(
                () -> get("/api/admin/events"),
                () -> post("/api/admin/events"),
                () -> get(base),
                () -> patch(base),
                () -> delete(base),
                () -> post(base + "/participants"),
                () -> patch(base + "/participants/" + pid),
                () -> delete(base + "/participants/" + pid),
                () -> post(base + "/draw"),
                () -> delete(base + "/draw"));
        // sin token, token inventado, token de participante y token de admin con otro esquema
        String[] headers = {null, "Bearer " + Ids.newId(), "Bearer " + participantToken, "Basic " + token};
        for (String header : headers) {
            for (Supplier<MockHttpServletRequestBuilder> make : calls) {
                MockHttpServletRequestBuilder call = make.get();
                if (header != null) {
                    call.header("Authorization", header);
                }
                mvc.perform(call.contentType(MediaType.APPLICATION_JSON).content("{}"))
                        .andExpect(status().isUnauthorized())
                        .andExpect(jsonPath("$.error").isString());
            }
        }
        // y el sorteo sigue ahí
        mvc.perform(auth(get(base))).andExpect(status().isOk());
    }

    // --- Sorteos ---

    @Test
    void createListGetPatchAndDeleteEvent() throws Exception {
        String older = createEvent("  Cena de empresa  ", " 20 € ", "2026-12-20");
        String newer = createEvent("Amigos del barrio", null, null);

        String list = mvc.perform(auth(get("/api/admin/events")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<String> ids = JsonPath.read(list, "$.events[*].id");
        assertThat(ids).contains(older, newer);
        assertThat(ids.indexOf(newer)).isLessThan(ids.indexOf(older));

        mvc.perform(auth(get("/api/admin/events/" + older)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.id").value(older))
                .andExpect(jsonPath("$.event.name").value("Cena de empresa"))
                .andExpect(jsonPath("$.event.budget").value("20 €"))
                .andExpect(jsonPath("$.event.date").value("2026-12-20"))
                .andExpect(jsonPath("$.event.drawDone").value(false))
                .andExpect(jsonPath("$.event.drawnAt").value(nullValue()))
                .andExpect(jsonPath("$.participants", hasSize(0)));
        mvc.perform(auth(get("/api/admin/events/" + newer)))
                .andExpect(jsonPath("$.event.budget").value(""))
                .andExpect(jsonPath("$.event.date").value(""));

        mvc.perform(auth(patch("/api/admin/events/" + older)).content(draft("Cena", "30 €", "")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.name").value("Cena"))
                .andExpect(jsonPath("$.event.budget").value("30 €"))
                .andExpect(jsonPath("$.event.date").value(""));

        mvc.perform(auth(delete("/api/admin/events/" + older)))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
        mvc.perform(auth(get("/api/admin/events/" + older)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Ese sorteo ya no existe."));
        mvc.perform(auth(delete("/api/admin/events/" + older))).andExpect(status().isNotFound());
        mvc.perform(auth(patch("/api/admin/events/" + older)).content(draft("X", "", "")))
                .andExpect(status().isNotFound());
    }

    @Test
    void eventValidation() throws Exception {
        expect400(post("/api/admin/events"), draft("   ", "", ""), "Ponle un nombre al sorteo.");
        expect400(post("/api/admin/events"), "{}", "Ponle un nombre al sorteo.");
        expect400(post("/api/admin/events"), draft("x".repeat(61), "", ""),
                "El nombre del sorteo es demasiado largo (máximo 60 letras).");
        expect400(post("/api/admin/events"), draft("Ok", "x".repeat(31), ""),
                "El presupuesto es demasiado largo (máximo 30 letras).");
        expect400(post("/api/admin/events"), draft("Ok", "", "24/12/2026"), "La fecha no es válida.");
        expect400(post("/api/admin/events"), draft("Ok", "", "2026-02-30"), "La fecha no es válida.");
        createEvent("x".repeat(60), "x".repeat(30), "2026-12-24");
    }

    @Test
    void deletingAnEventDeletesEverythingInside() throws Exception {
        String eventId = createEvent("Para borrar", "", "");
        String a = addParticipant(eventId, "Ana");
        addParticipant(eventId, "Bea");
        addParticipant(eventId, "Ceci");
        String participantToken = auth.openParticipantSession(a);
        mvc.perform(auth(post("/api/admin/events/" + eventId + "/draw"))).andExpect(status().isOk());

        mvc.perform(auth(delete("/api/admin/events/" + eventId))).andExpect(status().isNoContent());

        assertThat(participants.findById(a)).isEmpty();
        // la sesión de participante ya no vale para nada (ni para colarse en admin)
        mvc.perform(get("/api/admin/events").header("Authorization", "Bearer " + participantToken))
                .andExpect(status().isUnauthorized());
    }

    // --- Participantes ---

    @Test
    void addParticipantGivesUniqueCodes() throws Exception {
        String eventId = createEvent("Códigos", "", "");
        mvc.perform(auth(post("/api/admin/events/" + eventId + "/participants")).content("{\"name\":\"  Luna  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants[0].name").value("Luna"))
                .andExpect(jsonPath("$.participants[0].code").value(org.hamcrest.Matchers.matchesPattern(CODE_PATTERN)))
                .andExpect(jsonPath("$.participants[0].exclusions", hasSize(0)))
                .andExpect(jsonPath("$.participants[0].wishCount").value(0))
                .andExpect(jsonPath("$.participants[0].seenAt").value(nullValue()))
                .andExpect(jsonPath("$.participants[0].receiverId").doesNotExist());

        for (int i = 0; i < 20; i++) {
            addParticipant(eventId, "Persona " + i);
        }
        String state = getState(eventId);
        List<String> codes = JsonPath.read(state, "$.participants[*].code");
        List<String> names = JsonPath.read(state, "$.participants[*].name");
        assertThat(codes).hasSize(21).doesNotHaveDuplicates().allMatch(c -> c.matches(CODE_PATTERN));
        // en el orden en que se apuntaron
        assertThat(names.get(0)).isEqualTo("Luna");
        assertThat(names.get(20)).isEqualTo("Persona 19");
        assertThat(participants.findAll().stream().map(Participant::getCode)).doesNotHaveDuplicates();
    }

    @Test
    void participantNameValidation() throws Exception {
        String eventId = createEvent("Nombres", "", "");
        String path = "/api/admin/events/" + eventId + "/participants";
        addParticipant(eventId, "Luna");
        expect400(post(path), "{\"name\":\"  LUNA \"}", "Ya hay alguien llamado LUNA en este sorteo.");
        expect400(post(path), "{\"name\":\"   \"}", "Escribe un nombre.");
        expect400(post(path), "{}", "Escribe un nombre.");
        expect400(post(path), "{\"name\":\"" + "x".repeat(41) + "\"}", "El nombre es demasiado largo (máximo 40 letras).");
        addParticipant(eventId, "x".repeat(40));

        // el mismo nombre en otro sorteo sí vale
        addParticipant(createEvent("Otro", "", ""), "Luna");

        mvc.perform(auth(post("/api/admin/events/" + Ids.newId() + "/participants")).content("{\"name\":\"A\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Ese sorteo ya no existe."));
    }

    @Test
    void updateParticipantNameAndExclusions() throws Exception {
        String eventId = createEvent("Exclusiones", "", "");
        String luna = addParticipant(eventId, "Luna");
        String carlos = addParticipant(eventId, "Carlos");
        String marta = addParticipant(eventId, "Marta");
        String foreign = addParticipant(createEvent("Ajeno", "", ""), "Ajena");
        String path = "/api/admin/events/" + eventId + "/participants/";

        // a sí misma se descarta, los repetidos también
        mvc.perform(auth(patch(path + luna)).content("{\"exclusions\":[\"" + luna + "\",\"" + carlos + "\",\"" + carlos + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants[0].exclusions", hasSize(1)))
                .andExpect(jsonPath("$.participants[0].exclusions[0]").value(carlos))
                .andExpect(jsonPath("$.participants[0].name").value("Luna"));

        // gente de otro sorteo: no
        expect400(patch(path + luna), "{\"exclusions\":[\"" + foreign + "\"]}", "Esa persona no está en este sorteo.");
        mvc.perform(auth(get("/api/admin/events/" + eventId)))
                .andExpect(jsonPath("$.participants[0].exclusions[0]").value(carlos));

        // solo nombre: las exclusiones no se tocan; nombre en blanco deja el anterior
        mvc.perform(auth(patch(path + luna)).content("{\"name\":\"  Luna Pérez \"}"))
                .andExpect(jsonPath("$.participants[0].name").value("Luna Pérez"))
                .andExpect(jsonPath("$.participants[0].exclusions[0]").value(carlos));
        mvc.perform(auth(patch(path + luna)).content("{\"name\":\"   \"}"))
                .andExpect(jsonPath("$.participants[0].name").value("Luna Pérez"));
        // cambiar solo mayúsculas del propio nombre vale; ponerse el de otro, no
        mvc.perform(auth(patch(path + luna)).content("{\"name\":\"luna pérez\"}"))
                .andExpect(status().isOk());
        expect400(patch(path + luna), "{\"name\":\"marta\"}", "Ya hay alguien llamado marta en este sorteo.");
        expect400(patch(path + luna), "{\"name\":\"" + "x".repeat(41) + "\"}", "El nombre es demasiado largo (máximo 40 letras).");

        mvc.perform(auth(patch(path + marta)).content("{\"exclusions\":[]}"))
                .andExpect(status().isOk());
        mvc.perform(auth(patch(path + Ids.newId())).content("{\"name\":\"X\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Esa persona ya no está en la lista."));
    }

    @Test
    void removeParticipantCleansOthersExclusions() throws Exception {
        String eventId = createEvent("Quitar", "", "");
        String a = addParticipant(eventId, "Ana");
        String b = addParticipant(eventId, "Bea");
        String c = addParticipant(eventId, "Ceci");
        String path = "/api/admin/events/" + eventId + "/participants/";
        mvc.perform(auth(patch(path + a)).content("{\"exclusions\":[\"" + b + "\",\"" + c + "\"]}")).andExpect(status().isOk());

        mvc.perform(auth(delete(path + b)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants", hasSize(2)))
                .andExpect(jsonPath("$.participants[0].exclusions", hasSize(1)))
                .andExpect(jsonPath("$.participants[0].exclusions[0]").value(c));
        assertThat(participants.findById(b)).isEmpty();

        mvc.perform(auth(delete(path + b)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Esa persona ya no está en la lista."));
    }

    // --- Sorteo ---

    @Test
    void drawAssignsEveryoneRespectingExclusionsAndNeverLeaksPairs() throws Exception {
        String eventId = createEvent("Sorteo", "", "");
        String[] ids = new String[6];
        for (int i = 0; i < ids.length; i++) {
            ids[i] = addParticipant(eventId, "P" + i);
        }
        String path = "/api/admin/events/" + eventId;
        // P0 no puede regalar a P1 (ni P1 a P0), P2 no a P3
        mvc.perform(auth(patch(path + "/participants/" + ids[0])).content("{\"exclusions\":[\"" + ids[1] + "\"]}"));
        mvc.perform(auth(patch(path + "/participants/" + ids[2])).content("{\"exclusions\":[\"" + ids[3] + "\"]}"));

        for (int run = 0; run < 10; run++) {
            String state = mvc.perform(auth(post(path + "/draw")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.event.drawDone").value(true))
                    .andExpect(jsonPath("$.event.drawnAt", notNullValue()))
                    .andExpect(content().string(not(containsString("receiver"))))
                    .andReturn().getResponse().getContentAsString();
            assertThat(state).doesNotContain("receiverId");

            Map<String, String> pairs = Set.of(ids).stream()
                    .collect(Collectors.toMap(id -> id, id -> participants.findById(id).orElseThrow().getReceiverId()));
            assertThat(pairs.values()).doesNotContainNull();
            assertThat(new HashSet<>(pairs.values())).isEqualTo(Set.of(ids));
            pairs.forEach((giver, receiver) -> assertThat(giver).isNotEqualTo(receiver));
            assertThat(pairs.get(ids[0])).isNotEqualTo(ids[1]);
            assertThat(pairs.get(ids[1])).isNotEqualTo(ids[0]);
            assertThat(pairs.get(ids[2])).isNotEqualTo(ids[3]);
            assertThat(pairs.get(ids[3])).isNotEqualTo(ids[2]);
        }

        mvc.perform(auth(get(path))).andExpect(content().string(not(containsString("receiver"))));
        mvc.perform(auth(get("/api/admin/events"))).andExpect(content().string(not(containsString("receiver"))));

        // con el sorteo hecho no se añade ni se quita a nadie
        expect400(post(path + "/participants"), "{\"name\":\"Nuevo\"}", "El sorteo ya está hecho. Anúlalo para añadir a alguien.");
        mvc.perform(auth(delete(path + "/participants/" + ids[0])))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("El sorteo ya está hecho. Anúlalo para quitar a alguien."));
    }

    @Test
    void drawErrors() throws Exception {
        String eventId = createEvent("Poca gente", "", "");
        String a = addParticipant(eventId, "Ana");
        String b = addParticipant(eventId, "Bea");
        String path = "/api/admin/events/" + eventId;
        expect400(post(path + "/draw"), null, "Hacen falta al menos 3 personas para el sorteo.");

        addParticipant(eventId, "Ceci");
        mvc.perform(auth(patch(path + "/participants/" + a)).content("{\"exclusions\":[\"" + b + "\"]}"));
        expect400(post(path + "/draw"), null,
                "Con estas exclusiones no hay forma de hacer el sorteo. Quita alguna y prueba otra vez.");
        mvc.perform(auth(get(path))).andExpect(jsonPath("$.event.drawDone").value(false));
        assertThat(participants.findById(a).orElseThrow().getReceiverId()).isNull();

        mvc.perform(auth(post("/api/admin/events/" + Ids.newId() + "/draw"))).andExpect(status().isNotFound());
    }

    @Test
    void resetDrawKeepsWishlistsAndClearsSeen() throws Exception {
        String eventId = createEvent("Anular", "", "");
        String a = addParticipant(eventId, "Ana");
        addParticipant(eventId, "Bea");
        addParticipant(eventId, "Ceci");
        String path = "/api/admin/events/" + eventId;
        mvc.perform(auth(post(path + "/draw"))).andExpect(status().isOk());
        giveWishesAndSee(a);

        mvc.perform(auth(get(path)))
                .andExpect(jsonPath("$.participants[0].wishCount").value(1))
                .andExpect(jsonPath("$.participants[0].seenAt", notNullValue()));

        mvc.perform(auth(delete(path + "/draw")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.drawDone").value(false))
                .andExpect(jsonPath("$.event.drawnAt").value(nullValue()))
                .andExpect(jsonPath("$.participants[0].wishCount").value(1))
                .andExpect(jsonPath("$.participants[0].seenAt").value(nullValue()));
        assertThat(participants.findById(a).orElseThrow().getReceiverId()).isNull();

        // ya se puede volver a añadir gente
        addParticipant(eventId, "Dani");
    }

    @Test
    void eventSummaryCounters() throws Exception {
        String eventId = createEvent("Contadores", "10 €", "2026-12-24");
        String a = addParticipant(eventId, "Ana");
        String b = addParticipant(eventId, "Bea");
        addParticipant(eventId, "Ceci");
        mvc.perform(auth(post("/api/admin/events/" + eventId + "/draw"))).andExpect(status().isOk());
        giveWishesAndSee(a);
        tx.executeWithoutResult(s -> {
            Participant p = participants.findById(b).orElseThrow();
            p.replaceWishes(List.of(new Wish(Ids.newId(), p, 0, "Libro", null)));
        });

        String list = mvc.perform(auth(get("/api/admin/events"))).andReturn().getResponse().getContentAsString();
        String prefix = "$.events[?(@.id == '" + eventId + "')]";
        assertThat(JsonPath.<List<Integer>>read(list, prefix + ".participantCount")).containsExactly(3);
        assertThat(JsonPath.<List<Integer>>read(list, prefix + ".wishlistCount")).containsExactly(2);
        assertThat(JsonPath.<List<Integer>>read(list, prefix + ".seenCount")).containsExactly(1);
        assertThat(JsonPath.<List<Boolean>>read(list, prefix + ".drawDone")).containsExactly(true);
        assertThat(JsonPath.<List<String>>read(list, prefix + ".budget")).containsExactly("10 €");
        assertThat(JsonPath.<List<String>>read(list, prefix + ".date")).containsExactly("2026-12-24");
        assertThat(JsonPath.<List<String>>read(list, "$.events[*].id")).contains(eventId);
        mvc.perform(auth(get("/api/admin/events"))).andExpect(jsonPath("$.events[*].id", hasItem(eventId)));
    }

    // --- Ayudantes ---

    /** Simula que alguien rellena su lista y abre su sobre (eso lo hace la parte de participantes). */
    private void giveWishesAndSee(String participantId) {
        tx.executeWithoutResult(s -> {
            Participant p = participants.findById(participantId).orElseThrow();
            p.replaceWishes(List.of(new Wish(Ids.newId(), p, 0, "Calcetines", null)));
            p.setSeenAt(Instant.now());
        });
    }

    private String adminToken() throws Exception {
        String body = mvc.perform(post("/api/admin/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"test-admin\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private String createEvent(String name, String budget, String date) throws Exception {
        String body = mvc.perform(auth(post("/api/admin/events")).content(draft(name, budget, date)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    /** Añade a alguien y devuelve su id (el último de la lista). */
    private String addParticipant(String eventId, String name) throws Exception {
        String body = mvc.perform(auth(post("/api/admin/events/" + eventId + "/participants"))
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<String> ids = JsonPath.read(body, "$.participants[*].id");
        List<String> names = JsonPath.read(body, "$.participants[*].name");
        assertThat(names.get(names.size() - 1)).isEqualTo(name.trim());
        return ids.get(ids.size() - 1);
    }

    private String getState(String eventId) throws Exception {
        return mvc.perform(auth(get("/api/admin/events/" + eventId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private void expect400(MockHttpServletRequestBuilder request, String body, String error) throws Exception {
        MockHttpServletRequestBuilder r = auth(request);
        if (body != null) {
            r.content(body);
        }
        mvc.perform(r)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(error));
    }

    private static String draft(String name, String budget, String date) {
        return "{\"name\":" + json(name) + ",\"budget\":" + json(budget) + ",\"date\":" + json(date) + "}";
    }

    private static String json(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }
}
