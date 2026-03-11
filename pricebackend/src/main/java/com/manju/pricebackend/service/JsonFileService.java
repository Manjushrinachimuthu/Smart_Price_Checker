package com.manju.pricebackend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JsonFileService {
  private final ObjectMapper mapper;
  private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
  private final Path dataDir;

  public JsonFileService(@Value("${pricesage.data-dir:./data}") String dataDirPath) {
    this.mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    this.dataDir = Paths.get(dataDirPath).normalize();
  }

  public Map<String, Object> readObject(String filename) {
    lock.readLock().lock();
    try {
      Path path = dataDir.resolve(filename);
      if (!Files.exists(path)) return new HashMap<>();
      return mapper.readValue(path.toFile(), new TypeReference<>() {});
    } catch (Exception ignored) {
      return new HashMap<>();
    } finally {
      lock.readLock().unlock();
    }
  }

  public List<Map<String, Object>> readArray(String filename) {
    lock.readLock().lock();
    try {
      Path path = dataDir.resolve(filename);
      if (!Files.exists(path)) return new ArrayList<>();
      return mapper.readValue(path.toFile(), new TypeReference<>() {});
    } catch (Exception ignored) {
      return new ArrayList<>();
    } finally {
      lock.readLock().unlock();
    }
  }

  public void writeObject(String filename, Map<String, Object> value) {
    lock.writeLock().lock();
    try {
      ensureDir();
      mapper.writeValue(dataDir.resolve(filename).toFile(), value);
    } catch (IOException e) {
      throw new RuntimeException("Failed to write " + filename, e);
    } finally {
      lock.writeLock().unlock();
    }
  }

  public void writeArray(String filename, List<Map<String, Object>> value) {
    lock.writeLock().lock();
    try {
      ensureDir();
      mapper.writeValue(dataDir.resolve(filename).toFile(), value);
    } catch (IOException e) {
      throw new RuntimeException("Failed to write " + filename, e);
    } finally {
      lock.writeLock().unlock();
    }
  }

  private void ensureDir() throws IOException {
    if (!Files.exists(dataDir)) Files.createDirectories(dataDir);
  }
}



