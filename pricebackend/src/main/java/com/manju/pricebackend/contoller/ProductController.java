package com.manju.pricebackend.controller;

import com.manju.pricebackend.model.Product;
import com.manju.pricebackend.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/products")
@CrossOrigin(origins = "http://localhost:3000")

public class ProductController {

    @Autowired
    private ProductService productService;

    @PostMapping
    public Product addProduct(@RequestBody Product product) {
        return productService.saveProduct(product);
    }

    @GetMapping
    public List<Product> getAllProducts() {
        return productService.getAllProducts();
    }

    @GetMapping("/search")
    public List<Product> searchProducts(@RequestParam String name) {
        return productService.getProductsByName(name);
    }
    @GetMapping("/compare")
    public List<Product> compareProducts(@RequestParam String name) {
        return productService.compareProducts(name);
    }
}