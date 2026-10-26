package com.amigoinvisible.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ParticipantRepository extends JpaRepository<Participant, String> {

    Optional<Participant> findByCode(String code);

    boolean existsByCode(String code);
}
