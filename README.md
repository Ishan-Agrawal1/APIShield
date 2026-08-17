# APIShield

### Automated REST API Vulnerability Detection & Security Assessment System

APIShield is an Information Security project that aims to provide an automated and explainable security assessment platform for REST APIs.

The system analyzes an authorized REST API, discovers its endpoints, performs selected security checks, identifies potential vulnerabilities, maps the findings to the OWASP API Security Top 10, assigns severity, and provides mitigation recommendations through a web-based dashboard.

---

## Objective

To develop an automated REST API security assessment system capable of identifying common API security vulnerabilities and providing understandable security findings, severity assessment, OWASP classification, and remediation recommendations.

---

## Security Areas

The initial version of APIShield focuses on the following OWASP API Security risks:

1. **API1:2023 – Broken Object Level Authorization (BOLA)**
2. **API2:2023 – Broken Authentication**
3. **API4:2023 – Unrestricted Resource Consumption**
4. **API8:2023 – Security Misconfiguration**
5. **API9:2023 – Improper Inventory Management**

The project will initially focus on these selected vulnerabilities rather than attempting to implement the complete OWASP API Security Top 10.

---

## Planned Features

- REST API security assessment
- OpenAPI/Swagger specification support
- API endpoint discovery
- Authentication security analysis
- Broken Object Level Authorization detection
- Rate-limit and resource-consumption testing
- Security configuration analysis
- API inventory analysis
- OWASP API Security Top 10 mapping
- Vulnerability severity assessment
- Evidence-based vulnerability reports
- Mitigation recommendations
- Security score generation
- Scan history and result storage
- Web-based security dashboard
- Dockerized vulnerable API testing environment

---

## System Architecture

```text
                         APIShield
                            │
              ┌─────────────┴─────────────┐
              │                           │
        React Frontend              Express Backend
              │                           │
              │                    ┌──────┴───────┐
              │                    │              │
              │                 REST API       Scanner
              │                    │              │
              │                    │        ┌─────┼─────┐
              │                    │        │     │     │
              │                    │      Auth  BOLA  Config
              │                    │
              │                    ↓
              │                 MongoDB
              │
              └────────── HTTP ──────────────┘

                         Scanner
                            │
                            ↓
                    Vulnerable API Lab
                       (Dockerized)