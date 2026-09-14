import { createFileRoute } from "@tanstack/react-router";
import { Header } from "../components/Header";
import styles from "./alpha.module.css";

export const Route = createFileRoute("/alpha")({ component: Alpha });

function Alpha() {
  return (
    <main className={styles.page}>
      <Header title="Alpha" />
    </main>
  );
}
