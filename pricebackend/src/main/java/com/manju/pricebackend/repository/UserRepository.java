package com.manju.pricebackend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.manju.pricebackend.model.User;

public interface UserRepository extends JpaRepository<User, Long> {

    User findByEmail(String email);

}