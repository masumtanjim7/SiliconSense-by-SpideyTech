from fastapi.testclient import TestClient


def test_health_endpoint_returns_healthy_and_connected(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200

    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["database"] == "connected"
    assert payload["service"] == "SiliconSense by SpideyTech API"
    assert "X-Request-ID" in response.headers
