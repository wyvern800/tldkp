import { SignIn } from "@clerk/clerk-react";
import styled from "styled-components";

const Wrapper = styled.div`
  .cl-footerAction {
    //display: none !important;
  }
`;

export default function SignInPage() {
  return (
    <Wrapper>
      <SignIn path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
    </Wrapper>
  );
}
