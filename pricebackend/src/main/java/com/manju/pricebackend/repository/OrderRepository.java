package com.manju.pricebackend.repository;

import com.manju.pricebackend.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {
}