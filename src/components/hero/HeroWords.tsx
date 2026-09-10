export function HeroWords({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span className="hero-word-mask" key={i}>
          <span className="hero-word" style={{ animationDelay: `${0.05 + i * 0.07}s` }}>
            {word}
          </span>
        </span>
      ))}
    </>
  );
}
