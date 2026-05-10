package com.fixlocal.service.impl;

import com.fixlocal.service.TestimonialService;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import com.fixlocal.dto.TestimonialRequest;
import com.fixlocal.entity.Testimonial;
import com.fixlocal.exception.ErrorCode;
import com.fixlocal.exception.TestimonialException;
import com.fixlocal.repository.TestimonialRepository;
import com.fixlocal.util.LocationFormatUtil;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TestimonialServiceImpl implements TestimonialService {

    private final TestimonialRepository testimonialRepository;

    public List<Testimonial> findLatest(int limit) {
        return testimonialRepository.findAll(
                PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();
    }

    public Testimonial addTestimonial(TestimonialRequest request) {
        if (request.getName() == null || request.getName().isBlank()) {
            throw new TestimonialException(ErrorCode.USER_NOT_FOUND);
        }

        Testimonial testimonial = Testimonial.create(
                request.getName(),
                LocationFormatUtil.normalizeCityStateCountry(request.getCity()),
                request.getRole(),
                request.getQuote()
        );
        return testimonialRepository.save(testimonial);
    }
}