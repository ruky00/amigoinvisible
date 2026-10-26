package com.amigoinvisible.auth;

import java.time.Instant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface AppSessionRepository extends JpaRepository<AppSession, String> {

    @Modifying
    @Query("delete from AppSession s where s.expiresAt <= :now")
    int deleteExpired(Instant now);
}
