package com.fixlocal.service.impl;

import com.fixlocal.service.TradespersonService;
import com.fixlocal.dto.ServiceOfferingDTO;
import com.fixlocal.dto.TradespersonDTO;
import com.fixlocal.exception.UserException;
import com.fixlocal.exception.ErrorCode;
import com.fixlocal.entity.*;
import com.fixlocal.enums.*;
import com.fixlocal.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TradespersonServiceImpl implements TradespersonService {

    private final UserRepository userRepository;

    // ======================================================
    // SEARCH TRADESPERSONS
    // ======================================================

    public Page<TradespersonDTO> searchTradespersons(
            String city,
            String occupation,
            Double minRating,
            String tag,
            Double latitude,
            Double longitude,
            Double radiusKm,
            int page,
            int size
    ) {

        if (city == null || city.isBlank()) {
            throw new UserException(ErrorCode.CITY_REQUIRED);
        }

        city = city.trim();
        if (occupation != null) {
            occupation = occupation.trim();
        }
        final String requestedOccupation = occupation;

        Pageable pageable = PageRequest.of(page, size);

        Page<User> users;

        // ⭐ SEARCH WITH OCCUPATION
        if (occupation != null && !occupation.isBlank()) {

            users = userRepository
                    .findByRoleAndWorkingCityIgnoreCaseAndOccupationIgnoreCaseAndStatusAndVerifiedTrueAndBlockedFalse(
                            Role.TRADESPERSON,
                            city,
                            occupation,
                            Status.AVAILABLE,
                            pageable
                    );

        }

        // ⭐ SEARCH WITHOUT OCCUPATION
        else {

            users = userRepository
                    .findByRoleAndWorkingCityIgnoreCaseAndStatusAndVerifiedTrueAndBlockedFalse(
                            Role.TRADESPERSON,
                            city,
                            Status.AVAILABLE,
                            pageable
                    );
        }

        List<TradespersonDTO> dtoList = users.getContent()
                .stream()
                .filter(user ->
                        (minRating == null || user.getAverageRating() >= minRating) &&
                                (tag == null || (user.getSkillTags() != null && user.getSkillTags().contains(tag))) &&
                                withinRadius(user, latitude, longitude, radiusKm)
                )
                .map(user -> mapToDTOWithDistance(user, latitude, longitude, requestedOccupation, radiusKm))
                .sorted((a, b) -> {
                    double scoreA = a.getAiMatchScore() == null ? 0.0 : a.getAiMatchScore();
                    double scoreB = b.getAiMatchScore() == null ? 0.0 : b.getAiMatchScore();
                    int scoreCompare = Double.compare(scoreB, scoreA);
                    if (scoreCompare != 0) {
                        return scoreCompare;
                    }

                    return Double.compare(
                            a.getDistanceKm() == null ? Double.MAX_VALUE : a.getDistanceKm(),
                            b.getDistanceKm() == null ? Double.MAX_VALUE : b.getDistanceKm()
                    );
                })
                .toList();

        return new PageImpl<>(dtoList, pageable, users.getTotalElements());
    }

    // ======================================================
    // GET SINGLE TRADESPERSON
    // ======================================================

    public TradespersonDTO getTradespersonById(String id) {

        User tradesperson = userRepository.findById(id)
                .orElseThrow(() -> new UserException(ErrorCode.TRADESPERSON_NOT_FOUND));

        if (tradesperson.getRole() != Role.TRADESPERSON) {
            throw new UserException(ErrorCode.TARGET_NOT_TRADESPERSON);
        }

        return mapToDTO(tradesperson);
    }

    // ======================================================
    // DTO MAPPER
    // ======================================================

    private TradespersonDTO mapToDTO(User user) {

        TradespersonDTO dto = new TradespersonDTO();

        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setPhone(user.getResolvedPhone());
        dto.setOccupation(user.getOccupation());
        dto.setWorkingCity(user.getWorkingCity());
        dto.setExperience(user.getExperience());

        dto.setAverageRating(user.getAverageRating());
        dto.setTotalReviews(user.getTotalReviews());

        dto.setVerified(user.isVerified());
        dto.setStatus(user.getStatus());
        dto.setAvailable(user.isAvailable());

        // ⭐ Safe UI fields
        dto.setProfileImage(user.getProfileImage());
        dto.setBio(user.getBio());
        dto.setCompletedJobs(user.getCompletedJobs());

        dto.setLastKnownLatitude(user.getLastKnownLatitude());
        dto.setLastKnownLongitude(user.getLastKnownLongitude());

        dto.setSkillTags(user.getSkillTags());
        List<ServiceOffering> offerings = user.getServiceOfferings() == null
                ? Collections.emptyList()
                : user.getServiceOfferings();
        dto.setServiceOfferings(
                offerings.stream()
                        .map(offering -> this.mapServiceOffering(offering))
                        .collect(Collectors.toList())
        );

        enrichAiFields(dto, user, null, null, user.getOccupation(), null);

        return dto;
    }

    private ServiceOfferingDTO mapServiceOffering(ServiceOffering offering) {

        ServiceOfferingDTO dto = new ServiceOfferingDTO();
        dto.setId(offering.getId());
        dto.setName(offering.getName());
        dto.setDescription(offering.getDescription());
        dto.setBasePrice(offering.getBasePrice());
        dto.setDurationMinutes(offering.getDurationMinutes());

        return dto;
    }

    private TradespersonDTO mapToDTOWithDistance(User user,
                                                 Double latitude,
                                                 Double longitude,
                                                 String occupation,
                                                 Double radiusKm) {

        TradespersonDTO dto = mapToDTO(user);
        Double distanceKm = null;

        if (latitude != null && longitude != null && user.getLastKnownLatitude() != null && user.getLastKnownLongitude() != null) {
            distanceKm = haversine(latitude, longitude,
                    user.getLastKnownLatitude(), user.getLastKnownLongitude());
            dto.setDistanceKm(distanceKm);
        }

        enrichAiFields(dto, user, latitude, longitude, occupation, radiusKm);

        return dto;
    }

    private void enrichAiFields(TradespersonDTO dto,
                                User user,
                                Double requesterLatitude,
                                Double requesterLongitude,
                                String requestedOccupation,
                                Double radiusKm) {
        Double distanceKm = dto.getDistanceKm();
        if (distanceKm == null
                && requesterLatitude != null
                && requesterLongitude != null
                && user.getLastKnownLatitude() != null
                && user.getLastKnownLongitude() != null) {
            distanceKm = haversine(requesterLatitude,
                    requesterLongitude,
                    user.getLastKnownLatitude(),
                    user.getLastKnownLongitude());
            dto.setDistanceKm(distanceKm);
        }

        double aiScore = computeAiMatchScore(user, distanceKm, radiusKm);
        double[] fairOffer = estimateFairOffer(user, requestedOccupation);

        dto.setAiMatchScore(Math.round(aiScore * 10.0) / 10.0);
        dto.setAiMatchReason(buildAiMatchReason(user, distanceKm));
        dto.setAiSuggestedOfferMin(fairOffer[0]);
        dto.setAiSuggestedOfferMax(fairOffer[1]);
        dto.setAiSuggestedOffer(fairOffer[2]);
    }

    private double computeAiMatchScore(User user,
                                       Double distanceKm,
                                       Double radiusKm) {
        double rating = user.getAverageRating() == null ? 0.0 : user.getAverageRating();
        int experience = user.getExperience() == null ? 0 : user.getExperience();
        int completedJobs = user.getCompletedJobs() == null ? 0 : user.getCompletedJobs();
        int totalReviews = user.getTotalReviews() == null ? 0 : user.getTotalReviews();

        double ratingScore = clamp01(rating / 5.0);
        double experienceScore = clamp01(experience / 15.0);
        double jobsScore = clamp01(completedJobs / 200.0);
        double reviewScore = clamp01(totalReviews / 80.0);
        double verificationScore = user.isVerified() ? 1.0 : 0.4;

        double distanceScore;
        if (distanceKm == null) {
            distanceScore = 0.65;
        } else {
            double effectiveRadius = (radiusKm == null || radiusKm <= 0)
                    ? 15.0
                    : Math.max(radiusKm, 1.0);
            distanceScore = clamp01(1.0 - (distanceKm / effectiveRadius));
        }

        return (
                (ratingScore * 0.34) +
                        (distanceScore * 0.24) +
                        (experienceScore * 0.16) +
                        (jobsScore * 0.14) +
                        (reviewScore * 0.08) +
                        (verificationScore * 0.04)
        ) * 100.0;
    }

    private String buildAiMatchReason(User user, Double distanceKm) {
        List<String> reasons = new ArrayList<>();

        double rating = user.getAverageRating() == null ? 0.0 : user.getAverageRating();
        int completedJobs = user.getCompletedJobs() == null ? 0 : user.getCompletedJobs();
        int experience = user.getExperience() == null ? 0 : user.getExperience();

        if (rating >= 4.5) {
            reasons.add("excellent ratings");
        } else if (rating >= 4.0) {
            reasons.add("strong customer ratings");
        }

        if (completedJobs >= 100) {
            reasons.add("high completed jobs");
        }

        if (experience >= 7) {
            reasons.add("solid experience");
        }

        if (distanceKm != null && distanceKm <= 5.0) {
            reasons.add("close to your location");
        }

        if (reasons.isEmpty()) {
            reasons.add("good overall fit for your request");
        }

        return "AI match based on " + String.join(", ", reasons);
    }

    private double[] estimateFairOffer(User user, String requestedOccupation) {
        Double basePrice = estimateBasePriceFromOfferings(user, requestedOccupation);

        double rating = user.getAverageRating() == null ? 0.0 : user.getAverageRating();
        int experience = user.getExperience() == null ? 0 : user.getExperience();
        int completedJobs = user.getCompletedJobs() == null ? 0 : user.getCompletedJobs();

        if (basePrice == null || basePrice <= 0) {
            basePrice = 550.0 + (experience * 45.0) + (rating * 70.0) + (Math.min(completedJobs, 150) * 3.0);
        }

        double qualityMultiplier = 0.90
                + (clamp01(rating / 5.0) * 0.22)
                + (clamp01(experience / 15.0) * 0.08);

        double suggested = basePrice * qualityMultiplier;
        double min = Math.max(250.0, suggested * 0.90);
        double max = Math.max(min + 100.0, suggested * 1.15);

        min = roundToNearestTen(min);
        max = roundToNearestTen(max);
        suggested = roundToNearestTen((min + max) / 2.0);

        return new double[]{min, max, suggested};
    }

    private Double estimateBasePriceFromOfferings(User user, String requestedOccupation) {
        List<ServiceOffering> offerings = user.getServiceOfferings() == null
                ? Collections.emptyList()
                : user.getServiceOfferings();

        if (offerings.isEmpty()) {
            return null;
        }

        String occupation = requestedOccupation == null
                ? ""
                : requestedOccupation.trim().toLowerCase(Locale.ROOT);

        List<Double> preferredPrices = offerings.stream()
                .filter(offering -> offering != null && offering.getBasePrice() != null && offering.getBasePrice() > 0)
                .filter(offering -> {
                    if (occupation.isBlank()) {
                        return true;
                    }
                    String offeringName = offering.getName() == null
                            ? ""
                            : offering.getName().toLowerCase(Locale.ROOT);
                    if (offeringName.isBlank()) {
                        return false;
                    }
                    return offeringName.contains(occupation) || occupation.contains(offeringName);
                })
                .map(ServiceOffering::getBasePrice)
                .toList();

        List<Double> pricesToUse = preferredPrices;
        if (pricesToUse.isEmpty()) {
            pricesToUse = offerings.stream()
                    .filter(offering -> offering != null && offering.getBasePrice() != null && offering.getBasePrice() > 0)
                    .map(ServiceOffering::getBasePrice)
                    .toList();
        }

        if (pricesToUse.isEmpty()) {
            return null;
        }

        return pricesToUse.stream()
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
    }

    private double roundToNearestTen(double value) {
        return Math.round(value / 10.0) * 10.0;
    }

    private double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private boolean withinRadius(User user,
                                 Double latitude,
                                 Double longitude,
                                 Double radiusKm) {

        if (latitude == null || longitude == null || radiusKm == null) {
            return true;
        }

        if (user.getLastKnownLatitude() == null || user.getLastKnownLongitude() == null) {
            return false;
        }

        double distance = haversine(latitude, longitude,
                user.getLastKnownLatitude(), user.getLastKnownLongitude());
        return distance <= radiusKm;
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {

        double earthRadiusKm = 6371.0;

        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return earthRadiusKm * c;
    }
}