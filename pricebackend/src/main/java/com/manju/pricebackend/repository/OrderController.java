package com.manju.pricebackend.controller;

import com.manju.pricebackend.model.Order;
import com.manju.pricebackend.repository.OrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/orders")
@CrossOrigin(origins = "http://localhost:3000")
public class OrderController {

    @Autowired
    private OrderRepository orderRepository;

    @PostMapping
    public Order placeOrder(@RequestBody Order order) {
        order.setTotalPrice(order.getPrice() * order.getQuantity());
        return orderRepository.save(order);
    }
}