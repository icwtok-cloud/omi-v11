"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useAccount, useConnect, useWriteContract, useSwitchChain } from "wagmi";
import { polygon, base } from "wagmi/chains";
import { parseUnits } from "viem";
import {
  startPayment,
  startLemonSqueezyCheckout,
  getPaymentStatus,
  getUserMe,
  PaymentStartResult,
  downloadUrl,
  triggerAuthedDownload,
} from "@/lib/api";
import { USDC_CONTRACTS, USDC_DECIMALS, ERC20_TRANSFER_ABI } from "@/lib/wagmi";

type Network = "polygon" | "base";
type Locale = "es" | "pt";

const CHAIN_BY_NETWORK: Record<Network, typeof polygon | typeof base> = {
  polygon,
  base,
};

type Step = "choose" | "connect" | "confirm-wallet" | "waiting" | "resuming-card" | "confirmed" | "error";
// "subscription_covered" = ya tiene una suscripción activa con cuota
// disponible este mes -- no hay que iniciar un pago nuevo, solo usar
// la cuota que ya pagó. "subscription" = arrancar una suscripción
// nueva (todavía no tiene una, o se le venció).
type PaymentType = "free" | "per_project" | "subscription" | "subscription_covered" | "annual";

const COPY = {
  es: {
    startPaymentError: "No se pudo iniciar el pago",
    txError: "No se pudo completar la transacción",
    windowExpired: "La ventana de pago expiró. Iniciá el pago de nuevo.",
    downloadError: "No se pudo descargar",
    downloadEnabled: "Descarga habilitada",
    coveredBySubscription: "Cubierto por tu suscripción",
    paymentConfirmed: "Pago confirmado",
    downloadFile: "Descargar archivo corregido",
    unvalidatedWarning: (n: number) =>
      `Tenés ${n} módulo${n === 1 ? "" : "s"} sin analizar -- ${n === 1 ? "no se incluirá" : "no se incluirán"} en la descarga.`,
    downloadAnyway: "Descargar de todas formas",
    cancelDownload: "Cancelar",
    preparingDownload: "Preparando descarga...",
    unlockDownload: "Desbloqueá la descarga",
    freeOneModule: "Gratis · 1 módulo",
    perProject: "Por proyecto · $99",
    yourSubscription: (used: number, limit: number) => `Tu suscripción (${used}/${limit})`,
    monthly: "Mensual · $149",
    monthlyTrialBadge: "3 días gratis",
    monthlyTrialExplain: "Empezás con 3 días gratis. Recién después se cobra la suscripción mensual -- podés cancelar antes sin que se cobre nada.",
    annual: "Anual · $799",
    freeExplain:
      "Tu proyecto de prueba gratis incluye 1 módulo, con reporte y descarga -- una sola vez por cuenta. No hace falta wallet ni pago para esto.",
    coveredExplain: (used: number, limit: number) =>
      `Ya tenés una suscripción activa -- usaste ${used} de ${limit} exportaciones este mes. No hace falta pagar de nuevo ni conectar wallet para este proyecto.`,
    network: "Red",
    downloadCta: "Descargar",
    continueUsdc: "Continuar con USDC",
    payWithCard: "Pagar con tarjeta",
    redirectingToCheckout: "Abriendo el checkout...",
    resumingCardPayment: "Verificando tu pago con tarjeta...",
    exactAmount: "Monto exacto",
    address: "Dirección",
    amountMustMatch: "El monto tiene que coincidir exactamente — es lo que nos permite identificar tu pago de forma automática.",
    confirmInMetamask: "Confirmá en MetaMask...",
    payWithMetamask: "Pagar con MetaMask",
    connectAndPay: "Conectar MetaMask y pagar",
    waitingConfirmation: (network: string) => `Esperando confirmación en la red (${network})...`,
    waitingMinutes: "Esto puede tardar uno o dos minutos.",
    tryAgain: "Intentar de nuevo",
    checklistTitle: "Antes de importar en Odoo, tené en cuenta:",
    checklistDisclaimer: "Esta checklist es una guía general -- no reemplaza el criterio de quien hace la importación en tu Odoo.",
    checklist: [
      "Backup de la base de Odoo antes de importar",
      "Activar el modo desarrollador",
      "Importar primero los módulos base (Contactos, Productos) antes que los que dependen de ellos",
      "Verificar que los impuestos y listas de precio usados en el archivo existan en tu Odoo",
      "Revisar que las compañías/multi-empresa estén bien asignadas",
      "Hacer una prueba con un lote chico (50 registros) antes de importar todo",
    ],
  },
  pt: {
    startPaymentError: "Não foi possível iniciar o pagamento",
    txError: "Não foi possível concluir a transação",
    windowExpired: "A janela de pagamento expirou. Inicie o pagamento novamente.",
    downloadError: "Não foi possível baixar",
    downloadEnabled: "Download habilitado",
    coveredBySubscription: "Coberto pela sua assinatura",
    paymentConfirmed: "Pagamento confirmado",
    downloadFile: "Baixar arquivo corrigido",
    unvalidatedWarning: (n: number) =>
      `Você tem ${n} módulo${n === 1 ? "" : "s"} sem analisar -- ${n === 1 ? "não será incluído" : "não serão incluídos"} no download.`,
    downloadAnyway: "Baixar mesmo assim",
    cancelDownload: "Cancelar",
    preparingDownload: "Preparando download...",
    unlockDownload: "Desbloqueie o download",
    freeOneModule: "Grátis · 1 módulo",
    perProject: "Por projeto · $99",
    yourSubscription: (used: number, limit: number) => `Sua assinatura (${used}/${limit})`,
    monthly: "Mensal · $149",
    monthlyTrialBadge: "3 dias grátis",
    monthlyTrialExplain: "Você começa com 3 dias grátis. A assinatura mensal só é cobrada depois -- pode cancelar antes sem pagar nada.",
    annual: "Anual · $799",
    freeExplain:
      "Seu projeto de teste grátis inclui 1 módulo, com relatório e download -- uma única vez por conta. Não precisa de carteira nem pagamento para isso.",
    coveredExplain: (used: number, limit: number) =>
      `Você já tem uma assinatura ativa -- usou ${used} de ${limit} exportações este mês. Não precisa pagar de novo nem conectar carteira para este projeto.`,
    network: "Rede",
    downloadCta: "Baixar",
    continueUsdc: "Continuar com USDC",
    payWithCard: "Pagar com cartão",
    redirectingToCheckout: "Abrindo o checkout...",
    resumingCardPayment: "Verificando seu pagamento com cartão...",
    exactAmount: "Valor exato",
    address: "Endereço",
    amountMustMatch: "O valor precisa coincidir exatamente — é isso que nos permite identificar seu pagamento automaticamente.",
    confirmInMetamask: "Confirme na MetaMask...",
    payWithMetamask: "Pagar com MetaMask",
    connectAndPay: "Conectar MetaMask e pagar",
    waitingConfirmation: (network: string) => `Aguardando confirmação na rede (${network})...`,
    waitingMinutes: "Isso pode levar um ou dois minutos.",
    tryAgain: "Tentar novamente",
    checklistTitle: "Antes de importar no Odoo, tenha em conta:",
    checklistDisclaimer: "Esta checklist é um guia geral -- não substitui o critério de quem faz a importação no seu Odoo.",
    checklist: [
      "Backup da base do Odoo antes de importar",
      "Ativar o modo desenvolvedor",
      "Importar primeiro os módulos base (Contatos, Produtos) antes dos que dependem deles",
      "Verificar se os impostos e listas de preço usados no arquivo existem no seu Odoo",
      "Revisar se as empresas/multi-empresa estão bem atribuídas",
      "Fazer um teste com um lote pequeno (50 registros) antes de importar tudo",
    ],
  },
} as const;

export function PaywallPanel({
  projectId,
  priceLabel,
  locale = "es",
  unvalidatedCount = 0,
}: {
  projectId: string;
  priceLabel: string;
  locale?: Locale;
  unvalidatedCount?: number;
}) {
  const t = COPY[locale];
  const { getToken } = useAuth();
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [network, setNetwork] = useState<Network>("polygon");
  const [step, setStep] = useState<Step>("choose");
  const [payment, setPayment] = useState<PaymentStartResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [confirmingUnvalidated, setConfirmingUnvalidated] = useState(false);
  const [freeProjectAvailable, setFreeProjectAvailable] = useState(false);
  const [subscriptionCoveredInfo, setSubscriptionCoveredInfo] = useState<{
    used: number;
    limit: number;
  } | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("per_project");
  const [isStartingCardPayment, setIsStartingCardPayment] = useState(false);

  // Al volver del checkout de Lemon Squeezy, la redirect_url que arma
  // el backend (lemonsqueezy.py) trae ?ls_payment_id=... -- NO es una
  // confirmación de pago (el usuario pudo haber cancelado o cerrado la
  // pestaña antes), es solo la señal de "puede que haya pagado,
  // consultá el estado real". El desbloqueo real depende pura y
  // exclusivamente del webhook (ver /webhooks/lemonsqueezy).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lsPaymentId = params.get("ls_payment_id");
    if (!lsPaymentId) return;

    window.history.replaceState({}, "", window.location.pathname);

    setStep("resuming-card");
    getPaymentStatus(getToken, lsPaymentId)
      .then((status) => {
        if (status.status === "confirmed") {
          setStep("confirmed");
        } else {
          const expiresInTenMinutes = new Date(Date.now() + 10 * 60_000).toISOString();
          setStep("waiting");
          pollPaymentStatus(lsPaymentId, expiresInTenMinutes);
        }
      })
      .catch(() => {
        setStep("choose");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCardPayment() {
    setErrorMsg(null);
    setIsStartingCardPayment(true);
    try {
      const result = await startLemonSqueezyCheckout(
        getToken,
        paymentType as "per_project" | "subscription" | "annual",
        projectId
      );
      window.location.href = result.checkout_url;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t.startPaymentError);
      setStep("error");
      setIsStartingCardPayment(false);
    }
  }

  // Si el usuario cierra la pestaña o recarga mientras espera la
  // confirmación on-chain (puede tardar minutos), sin esto perdía el
  // `payment_id` -- al volver no había forma de ver que ya había
  // pagado, y el único camino visible era iniciar un pago NUEVO
  // (arriesgando un doble pago real en USDC). Se persiste el pago en
  // curso en localStorage, scoped por proyecto, y se retoma al montar.
  const pendingPaymentKey = `omi_pending_payment_${projectId}`;

  // El timer del polling de pago vive en un ref para poder cancelarlo
  // al desmontar -- con el setInterval anterior, navegar fuera de la
  // página durante la espera de confirmación dejaba el intervalo vivo
  // para siempre, pegándole a /payments/{id}/status cada 8 segundos y
  // llamando setState sobre un componente desmontado.
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) clearTimeout(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(pendingPaymentKey);
    if (!stored) return;
    try {
      const savedPayment: PaymentStartResult = JSON.parse(stored);
      if (new Date(savedPayment.expires_at) < new Date()) {
        localStorage.removeItem(pendingPaymentKey);
        return;
      }
      getPaymentStatus(getToken, savedPayment.payment_id)
        .then((status) => {
          if (status.status === "confirmed") {
            localStorage.removeItem(pendingPaymentKey);
            setStep("confirmed");
          } else if (status.status === "expired") {
            localStorage.removeItem(pendingPaymentKey);
          } else {
            setPayment(savedPayment);
            setStep("waiting");
            pollPaymentStatus(savedPayment.payment_id, savedPayment.expires_at);
          }
        })
        .catch(() => {
          // si falla la consulta, no se bloquea el resto del flujo --
          // el usuario puede iniciar un pago nuevo si hace falta.
        });
    } catch {
      localStorage.removeItem(pendingPaymentKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getUserMe(getToken)
      .then((me) => {
        setFreeProjectAvailable(!me.free_project_used);
        const subscriptionHasQuota =
          me.has_active_subscription && me.monthly_export_count < me.monthly_export_limit;
        if (subscriptionHasQuota) {
          setSubscriptionCoveredInfo({
            used: me.monthly_export_count,
            limit: me.monthly_export_limit,
          });
        }
        // Prioridad: proyecto gratis (una sola vez, no requiere wallet) >
        // suscripción ya pagada con cuota disponible (tampoco requiere
        // wallet, ya la pagó) > pagar por proyecto como default.
        if (!me.free_project_used) {
          setPaymentType("free");
        } else if (subscriptionHasQuota) {
          setPaymentType("subscription_covered");
        }
      })
      .catch(() => {
        // si falla, simplemente no se ofrece la opción gratis/cubierta --
        // no debe bloquear el resto del flujo de pago.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStartFlow() {
    setErrorMsg(null);
    if (paymentType === "free" || paymentType === "subscription_covered") {
      // Ninguno de los dos pasa por USDC -- el backend ya lo autoriza
      // directo en GET /download (ver can_export_project() en
      // entitlements.py), sea por el proyecto gratis o por la cuota de
      // una suscripción ya pagada. Acá solo mostramos el botón de descarga.
      setStep("confirmed");
      return;
    }
    try {
      const result = await startPayment(getToken, paymentType, network, projectId);
      localStorage.setItem(pendingPaymentKey, JSON.stringify(result));
      setPayment(result);
      setStep("connect");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t.startPaymentError);
      setStep("error");
    }
  }

  async function handleConnectAndPay() {
    if (!payment) return;
    setErrorMsg(null);
    try {
      if (!isConnected) {
        await connectAsync({ connector: connectors[0] });
      }

      const targetChain = CHAIN_BY_NETWORK[network];
      if (chainId !== targetChain.id) {
        await switchChainAsync({ chainId: targetChain.id });
      }

      setStep("confirm-wallet");

      const amountInUnits = parseUnits(
        payment.expected_amount_usd.toFixed(4),
        USDC_DECIMALS
      );

      await writeContractAsync({
        address: USDC_CONTRACTS[targetChain.id],
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [payment.receive_address as `0x${string}`, amountInUnits],
        chainId: targetChain.id,
      });

      setStep("waiting");
      pollPaymentStatus(payment.payment_id, payment.expires_at);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t.txError);
      setStep("error");
    }
  }

  // Confirmaciones on-chain tardan minutos, no segundos -- la escala de
  // backoff es más lenta que la de polling de validación a propósito,
  // pero sigue siendo backoff progresivo (no un intervalo fijo) para no
  // pegarle a /payments/{id}/status a ritmo constante mientras el pago
  // sigue pendiente.
  const PAYMENT_POLL_INTERVALS_MS = [8000, 12000, 15000];

  function pollPaymentStatus(paymentId: string, expiresAt: string) {
    // setTimeout recursivo en vez de setInterval: no encola ticks si una
    // consulta tarda más que el intervalo, y el ref permite cancelarlo
    // al desmontar (cleanup en el useEffect de arriba).
    let pollCount = 0;
    const tick = async () => {
      try {
        const status = await getPaymentStatus(getToken, paymentId);
        if (status.status === "confirmed") {
          localStorage.removeItem(pendingPaymentKey);
          setStep("confirmed");
          return;
        }
        if (status.status === "expired") {
          localStorage.removeItem(pendingPaymentKey);
          setErrorMsg(t.windowExpired);
          setStep("error");
          return;
        }
      } catch {
        // un error transitorio de polling no debe interrumpir el intento
      }
      // Tope duro del loop: la expiración del propio pago (el backend
      // lo marca "expired" al consultarlo pasada esa hora, pero si la
      // red se cae y TODAS las consultas fallan, ese "expired" nunca
      // llega -- sin este corte local el loop seguiría para siempre).
      // Margen de 60s para que la última consulta vea el estado final.
      if (Date.now() > new Date(expiresAt).getTime() + 60_000) {
        localStorage.removeItem(pendingPaymentKey);
        setErrorMsg(t.windowExpired);
        setStep("error");
        return;
      }
      const interval =
        PAYMENT_POLL_INTERVALS_MS[Math.min(pollCount, PAYMENT_POLL_INTERVALS_MS.length - 1)];
      pollCount++;
      pollTimerRef.current = setTimeout(tick, interval);
    };
    pollTimerRef.current = setTimeout(tick, PAYMENT_POLL_INTERVALS_MS[0]);
  }

  if (step === "confirmed") {
    return (
      <div className="border border-verify bg-verify-light rounded-lg p-6 text-center">
        <p className="font-extrabold text-xl text-verify mb-3">
          {paymentType === "free"
            ? t.downloadEnabled
            : paymentType === "subscription_covered"
            ? t.coveredBySubscription
            : t.paymentConfirmed}
        </p>
        {unvalidatedCount > 0 && !confirmingUnvalidated && (
          <p className="text-alert text-sm bg-alert-light rounded-md px-4 py-2.5 mb-3">
            {t.unvalidatedWarning(unvalidatedCount)}
          </p>
        )}
        {unvalidatedCount > 0 && !confirmingUnvalidated ? (
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setConfirmingUnvalidated(true)}
              className="inline-block bg-verify text-white rounded-full px-6 py-2.5 font-medium hover:opacity-90 transition-opacity"
            >
              {t.downloadAnyway}
            </button>
            <button
              onClick={() => setStep("choose")}
              className="inline-block border border-line text-graphite rounded-full px-6 py-2.5 font-medium hover:border-ink hover:text-ink transition-colors"
            >
              {t.cancelDownload}
            </button>
          </div>
        ) : (
          <button
            onClick={async () => {
              if (isDownloading) return;
              setIsDownloading(true);
              setErrorMsg(null);
              try {
                await triggerAuthedDownload(getToken, downloadUrl(projectId), `omi_${projectId}.zip`);
              } catch (e) {
                setErrorMsg(e instanceof Error ? e.message : t.downloadError);
              } finally {
                setIsDownloading(false);
              }
            }}
            disabled={isDownloading}
            className="inline-block bg-verify text-white rounded-full px-6 py-2.5 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? t.preparingDownload : t.downloadFile}
          </button>
        )}
        {errorMsg && <p className="text-alert text-sm mt-2">{errorMsg}</p>}
        <PostDownloadChecklist locale={locale} />
      </div>
    );
  }

  return (
    <div className="border border-line bg-white rounded-lg p-6 space-y-5">
      <div>
        <p className="font-extrabold text-xl mb-1">{t.unlockDownload}</p>
        <p className="text-graphite text-sm">{priceLabel}</p>
      </div>

      {step === "choose" && (
        <>
          <div className="flex flex-wrap gap-2">
            {freeProjectAvailable && (
              <button
                onClick={() => setPaymentType("free")}
                className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  paymentType === "free"
                    ? "border-verify bg-verify-light text-verify"
                    : "border-line text-graphite"
                }`}
              >
                {t.freeOneModule}
              </button>
            )}
            <button
              onClick={() => setPaymentType("per_project")}
              className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                paymentType === "per_project"
                  ? "border-verify bg-verify-light text-verify"
                  : "border-line text-graphite"
              }`}
            >
              {t.perProject}
            </button>
            {subscriptionCoveredInfo ? (
              <button
                onClick={() => setPaymentType("subscription_covered")}
                className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  paymentType === "subscription_covered"
                    ? "border-verify bg-verify-light text-verify"
                    : "border-line text-graphite"
                }`}
              >
                {t.yourSubscription(subscriptionCoveredInfo.used, subscriptionCoveredInfo.limit)}
              </button>
            ) : (
              <button
                onClick={() => setPaymentType("subscription")}
                className={`relative flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  paymentType === "subscription"
                    ? "border-verify bg-verify-light text-verify"
                    : "border-line text-graphite"
                }`}
              >
                <span className="absolute -top-2.5 right-2 bg-verify text-white text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap">
                  {t.monthlyTrialBadge}
                </span>
                {t.monthly}
              </button>
            )}
            <button
              onClick={() => setPaymentType("annual")}
              className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                paymentType === "annual"
                  ? "border-verify bg-verify-light text-verify"
                  : "border-line text-graphite"
              }`}
            >
              {t.annual}
            </button>
          </div>

          {paymentType === "subscription" && (
            <p className="text-verify text-sm font-medium bg-verify-light rounded-md px-3 py-2">
              🎁 {t.monthlyTrialExplain}
            </p>
          )}

          {paymentType !== "free" && paymentType !== "subscription_covered" && (
            <button
              onClick={handleCardPayment}
              disabled={isStartingCardPayment}
              className="w-full border border-line text-ink rounded-full py-3 font-medium hover:border-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStartingCardPayment ? t.redirectingToCheckout : t.payWithCard}
            </button>
          )}

          {paymentType === "free" ? (
            <p className="text-xs text-graphite">{t.freeExplain}</p>
          ) : paymentType === "subscription_covered" && subscriptionCoveredInfo ? (
            <p className="text-xs text-graphite">
              {t.coveredExplain(subscriptionCoveredInfo.used, subscriptionCoveredInfo.limit)}
            </p>
          ) : (
            <div>
              <p className="text-sm font-medium mb-2">{t.network}</p>
              <div className="flex gap-2">
                {(["polygon", "base"] as Network[]).map((n) => (
                  <button
                    key={n}
                    onClick={() => setNetwork(n)}
                    className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                      network === n
                        ? "border-verify bg-verify-light text-verify"
                        : "border-line text-graphite"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleStartFlow}
            className="w-full bg-ink text-paper rounded-full py-3 font-medium hover:opacity-90 transition-opacity"
          >
            {paymentType === "free" || paymentType === "subscription_covered"
              ? t.downloadCta
              : t.continueUsdc}
          </button>
        </>
      )}

      {step === "resuming-card" && (
        <div className="text-center py-4">
          <p className="text-graphite text-sm">{t.resumingCardPayment}</p>
        </div>
      )}

      {(step === "connect" || step === "confirm-wallet") && payment && (
        <div className="space-y-4">
          <div className="bg-canvas border border-line rounded-md p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-graphite">{t.network}</span>
              <span className="font-mono capitalize">{network}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-graphite">{t.exactAmount}</span>
              <span className="font-mono">{payment.expected_amount_usd.toFixed(4)} USDC</span>
            </div>
            <div className="flex justify-between text-sm items-start">
              <span className="text-graphite">{t.address}</span>
              <span className="font-mono text-xs text-right break-all max-w-[60%]">
                {payment.receive_address}
              </span>
            </div>
          </div>
          <p className="text-xs text-graphite">{t.amountMustMatch}</p>
          <button
            onClick={handleConnectAndPay}
            disabled={step === "confirm-wallet"}
            className="w-full bg-verify text-white rounded-full py-3 font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {step === "confirm-wallet"
              ? t.confirmInMetamask
              : isConnected
              ? t.payWithMetamask
              : t.connectAndPay}
          </button>
        </div>
      )}

      {step === "waiting" && (
        <div className="text-center py-4">
          <p className="text-graphite text-sm">{t.waitingConfirmation(network)}</p>
          <p className="text-xs text-graphite mt-1">{t.waitingMinutes}</p>
        </div>
      )}

      {step === "error" && errorMsg && (
        <div className="space-y-3">
          <p className="text-alert text-sm bg-alert-light rounded-md px-4 py-2.5">
            {errorMsg}
          </p>
          <button
            onClick={() => {
              localStorage.removeItem(pendingPaymentKey);
              setStep("choose");
              setPayment(null);
            }}
            className="w-full border border-line rounded-full py-2.5 font-medium text-sm"
          >
            {t.tryAgain}
          </button>
        </div>
      )}
    </div>
  );
}

function PostDownloadChecklist({ locale = "es" }: { locale?: Locale }) {
  const t = COPY[locale];
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="mt-6 text-left border-t border-verify/30 pt-4">
      <p className="text-xs font-medium text-graphite mb-2">{t.checklistTitle}</p>
      <div className="space-y-1.5">
        {t.checklist.map((item, i) => (
          <label key={i} className="flex items-start gap-2 text-xs text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={checked.has(i)}
              onChange={() => toggle(i)}
              className="mt-0.5"
            />
            <span className={checked.has(i) ? "line-through text-graphite" : ""}>{item}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-graphite italic mt-2">{t.checklistDisclaimer}</p>
    </div>
  );
}
