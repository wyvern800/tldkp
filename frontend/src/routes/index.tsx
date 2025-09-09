import StackEx from "../Components/StackExp";
import { useEffect } from "react";

export default function IndexPage() {
  useEffect(() => {
    console.log("IndexPage mounted");
  }, []);

  return <StackEx />;
}
