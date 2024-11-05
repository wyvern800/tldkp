import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import sad from "../assets/sad.png";

const Wrapper = styled.div`

  .not-found-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
    background: #f0f4f8;
    color: #333;
    font-family: Arial, sans-serif;
  }

  .not-found-content {
    max-width: 500px;
    padding: 20px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    background-color: #ffffff;
    border-radius: 8px;
  }

  .not-found-title {
    font-size: 6rem;
    margin: 0;
    color: #e63946;
  }

  .not-found-text {
    font-size: 1.2rem;
    margin: 10px 0 20px;
    color: #555;
  }

  .not-found-image {
    width: 100%;
    height: auto;
    margin: 20px 0;
    border-radius: 8px;
  }

  .back-home-button {
    display: inline-block;
    padding: 10px 20px;
    font-size: 1rem;
    color: #fff;
    background-color: #e63946;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.3s ease;
  }

  .back-home-button:hover {
    background-color: #d62839;
  }
`;

function NotFound() {
  const navigate = useNavigate();

  return (
    <Wrapper>
      <div className="not-found-container">
        <div className="not-found-content">
          <h1 className="not-found-title">404</h1>
          <p className="not-found-text">
            Oops! The page you’re looking for doesn’t exist.
          </p>
          <img
            src={sad}
            alt="Not Found Illustration"
            className="not-found-image"
          />
          <button onClick={() => navigate("/")} className="back-home-button">
            Back to Home
          </button>
        </div>
      </div>
    </Wrapper>
  );
}

export default NotFound;
