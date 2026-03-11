package com.manju.pricebackend.service;

import com.manju.pricebackend.model.Product;
import com.manju.pricebackend.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProductService {

    @Autowired
    private ProductRepository productRepository;

    public Product saveProduct(Product product) {
        return productRepository.save(product);
    }

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    public List<Product> getProductsByName(String name) {
        return productRepository.findByNameIgnoreCase(name);
    }
    public List<Product> compareProducts(String name) {
        List<Product> products = productRepository.findByNameIgnoreCase(name);
        products.sort((p1, p2) -> Double.compare(p1.getPrice(), p2.getPrice()));
        return products;
    }
}
