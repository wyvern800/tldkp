import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Outlet, useNavigate } from "react-router-dom";
import { Spinner } from '@chakra-ui/react';

export default function HudsLayout() {
  const { userId, isLoaded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && !userId) {
      navigate("/sign-in");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  if (!isLoaded)
    return (
      <Spinner size='xl' />
    );

  return <Outlet />;
}
