import { createFileRoute } from "@tanstack/react-router";
import { Header } from "../components/Header";
import styles from "./beta.module.css";

export const Route = createFileRoute("/beta")({ component: Beta });

function Beta() {
  return (
    <main className={styles.page}>
      <Header title="Beta" />
    </main>
  );
}
