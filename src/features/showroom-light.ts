/**
 * Luz de showroom no destaque da home: um facho suave acompanha o cursor sobre a foto,
 * como uma lanterna examinando a pintura. Só com mouse (pointer: fine) e sem "movimento reduzido".
 *
 * O facho segue o cursor com interpolação (lerp) a cada quadro, para ter inércia em vez de
 * "grudar" no ponteiro; o transform é aplicado direto no elemento (sem variáveis CSS no pai).
 */
export function initShowroomLight() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (!fine.matches || reduce.matches) return;

  document.querySelectorAll<HTMLElement>('[data-showroom]').forEach((stage) => {
    const light = stage.querySelector<HTMLElement>('[data-showroom-light]');
    if (!light) return;

    let rect = stage.getBoundingClientRect();
    let targetX = rect.width / 2;
    let targetY = rect.height / 2;
    let x = targetX;
    let y = targetY;
    let frame = 0;

    const render = () => {
      x += (targetX - x) * 0.14;
      y += (targetY - y) * 0.14;
      light.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      frame = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.4 ? requestAnimationFrame(render) : 0;
    };

    stage.addEventListener('pointerenter', (event) => {
      rect = stage.getBoundingClientRect();
      x = targetX = event.clientX - rect.left;
      y = targetY = event.clientY - rect.top;
      render();
      stage.classList.add('is-lit');
    });
    stage.addEventListener('pointermove', (event) => {
      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;
      if (!frame) frame = requestAnimationFrame(render);
    });
    stage.addEventListener('pointerleave', () => stage.classList.remove('is-lit'));
  });
}
