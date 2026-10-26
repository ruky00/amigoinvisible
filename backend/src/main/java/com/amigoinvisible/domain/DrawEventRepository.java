package com.amigoinvisible.domain;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DrawEventRepository extends JpaRepository<DrawEvent, String> {

    /** Los sorteos más recientes primero, como los enseña "Mis sorteos". */
    List<DrawEvent> findAllByOrderByCreatedAtDesc();
}
