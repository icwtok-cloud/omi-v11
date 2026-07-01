"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useAccount, useConnect, useWriteContract, useSwitchChain } from "wagmi";
import { polygon, base } from "wagmi/chains";
import { parseUnits } from "viem";
import {
  startPayment,
  getPaymentStatus,
  getUserMe,
  PaymentStartResult,
  downloadUrl,
  triggerAuthedDownload,
} from "@/lib/api";
import { USDC_CONTRACTS, USDC_DECIMALS, ERC20_TRANSFER_ABI } from "@/lib/wagmi";

type Network = "polygon" | "base";

const CHAIN_BY_NETWORK: Record<Network, typeof polygon | typeof base> = {
  polygon,
  base,
};

type Step = "choose" | "connect" | "confirm-wallet" | "waiting" | "confirmed" | "error";
// "subscription_covered" = ya tiene una suscripción activa con cuota
// disponible este mes -- no hay que iniciar un pago nuevo, solo usar
// la cuota que ya pagó. "subscription" = arrancar una suscripción
// nueva (todavía no tiene una, o se le venció).
type PaymentType = "free" | "per_project" | "subscription" | "subscription_covered";

export function PaywallPanel({
  projectId,
  priceLabel,
}: {
  projectId: string;
  priceLabel: string;
}) {
  const { getToken } = useAuth();
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [network, setNetwork] = useState<Network>("polygon");
  const [step, setStep] = useState<Step>("choose");
  const [payment, setPayment] = useState<PaymentStartResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [freeProjectAvailable, setFreeProjectAvailable] = useState(false);
  const [subscriptionCoveredInfo, setSubscriptionCoveredInfo] = useState<{
    used: number;
    limit: number;
  } | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("per_project");

  // Si el usuario cierra la pestaña o recarga mientras espera la
  // confirmación on-chain (puede tardar minutos), sin esto perdía el
  // `payment_id` -- al volver no había forma de ver que ya había
  // pagado, y el único camino visible era iniciar un pago NUEVO
  // (arriesgando un doble pago real en USDC). Se persiste el pago en
  // curso en localStorage, scoped por proyecto, y se retoma al montar.
  const pendingPaymentKey = `omi_pending_payment_${projectId}`;

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
            pollPaymentStatus(savedPayment.payment_id);
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
      setErrorMsg(e instanceof Error ? e.message : "No se pudo iniciar el pago");
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
      pollPaymentStatus(payment.payment_id);
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "No se pudo completar la transacción"
      );
      setStep("error");
    }
  }

  function pollPaymentStatus(paymentId: string) {
    const interval = setInterval(async () => {
      try {
        const status = await getPaymentStatus(getToken, paymentId);
        if (status.status === "confirmed") {
          clearInterval(interval);
          localStorage.removeItem(pendingPaymentKey);
          setStep("confirmed");
        } else if (status.status === "expired") {
          clearInterval(interval);
          localStorage.removeItem(pendingPaymentKey);
          setErrorMsg("La ventana de pago expiró. Iniciá el pago de nuevo.");
          setStep("error");
        }
      } catch {
        // un error transitorio de polling no debe interrumpir el intento
      }
    }, 8000);
  }

  if (step === "confirmed") {
    return (
      <div className="border border-verify bg-verify-light rounded-lg p-6 text-center">
        <p className="font-extrabold text-xl text-verify mb-3">
          {paymentType === "free"
            ? "Descarga habilitada"
            : paymentType === "subscription_covered"
            ? "Cubierto por tu suscripción"
            : "Pago confirmado"}
        </p>
        <button
          onClick={() =>
            triggerAuthedDownload(getToken, downloadUrl(projectId), `omi_${projectId}.zip`).catch(
              (e) => setErrorMsg(e instanceof Error ? e.message : "No se pudo descargar")
            )
          }
          className="inline-block bg-verify text-white rounded-full px-6 py-2.5 font-medium hover:opacity-90 transition-opacity"
        >
          Descargar archivo corregido
        </button>
        {errorMsg && <p className="text-alert text-sm mt-2">{errorMsg}</p>}
        <PostDownloadChecklist />
      </div>
    );
  }

  return (
    <div className="border border-line bg-white rounded-lg p-6 space-y-5">
      <div>
        <p className="font-extrabold text-xl mb-1">Desbloqueá la descarga</p>
        <p className="text-graphite text-sm">{priceLabel}</p>
      </div>

      {step === "choose" && (
        <>
          <div className="flex gap-2">
            {freeProjectAvailable && (
              <button
                onClick={() => setPaymentType("free")}
                className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  paymentType === "free"
                    ? "border-verify bg-verify-light text-verify"
                    : "border-line text-graphite"
                }`}
              >
                Gratis · 1 módulo
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
              Por proyecto · $99
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
                Tu suscripción ({subscriptionCoveredInfo.used}/{subscriptionCoveredInfo.limit})
              </button>
            ) : (
              <button
                onClick={() => setPaymentType("subscription")}
                className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  paymentType === "subscription"
                    ? "border-verify bg-verify-light text-verify"
                    : "border-line text-graphite"
                }`}
              >
                Mensual · $149
              </button>
            )}
          </div>

          {paymentType === "free" ? (
            <p className="text-xs text-graphite">
              Tu proyecto de prueba gratis incluye 1 módulo, con reporte y
              descarga -- una sola vez por cuenta. No hace falta wallet ni
              pago para esto.
            </p>
          ) : paymentType === "subscription_covered" && subscriptionCoveredInfo ? (
            <p className="text-xs text-graphite">
              Ya tenés una suscripción activa -- usaste{" "}
              {subscriptionCoveredInfo.used} de {subscriptionCoveredInfo.limit} exportaciones
              este mes. No hace falta pagar de nuevo ni conectar wallet para este proyecto.
            </p>
          ) : (
            <div>
              <p className="text-sm font-medium mb-2">Red</p>
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
              ? "Descargar"
              : "Continuar con USDC"}
          </button>
        </>
      )}

      {(step === "connect" || step === "confirm-wallet") && payment && (
        <div className="space-y-4">
          <div className="bg-canvas border border-line rounded-md p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-graphite">Red</span>
              <span className="font-mono capitalize">{network}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-graphite">Monto exacto</span>
              <span className="font-mono">{payment.expected_amount_usd.toFixed(4)} USDC</span>
            </div>
            <div className="flex justify-between text-sm items-start">
              <span className="text-graphite">Dirección</span>
              <span className="font-mono text-xs text-right break-all max-w-[60%]">
                {payment.receive_address}
              </span>
            </div>
          </div>
          <p className="text-xs text-graphite">
            El monto tiene que coincidir exactamente — es lo que nos permite
            identificar tu pago de forma automática.
          </p>
          <button
            onClick={handleConnectAndPay}
            disabled={step === "confirm-wallet"}
            className="w-full bg-verify text-white rounded-full py-3 font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {step === "confirm-wallet"
              ? "Confirmá en MetaMask..."
              : isConnected
              ? "Pagar con MetaMask"
              : "Conectar MetaMask y pagar"}
          </button>
        </div>
      )}

      {step === "waiting" && (
        <div className="text-center py-4">
          <p className="text-graphite text-sm">
            Esperando confirmación en la red ({network})...
          </p>
          <p className="text-xs text-graphite mt-1">
            Esto puede tardar uno o dos minutos.
          </p>
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
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}

const POST_DOWNLOAD_CHECKLIST = [
  "Backup de la base de Odoo antes de importar",
  "Activar el modo desarrollador",
  "Importar primero los módulos base (Contactos, Productos) antes que los que dependen de ellos",
  "Verificar que los impuestos y listas de precio usados en el archivo existan en tu Odoo",
  "Revisar que las compañías/multi-empresa estén bien asignadas",
  "Hacer una prueba con un lote chico (50 registros) antes de importar todo",
];

function PostDownloadChecklist() {
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
      <p className="text-xs font-medium text-graphite mb-2">
        Antes de importar en Odoo, tené en cuenta:
      </p>
      <div className="space-y-1.5">
        {POST_DOWNLOAD_CHECKLIST.map((item, i) => (
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
      <p className="text-xs text-graphite italic mt-2">
        Esta checklist es una guía general -- no reemplaza el criterio de quien hace la
        importación en tu Odoo.
      </p>
    </div>
  );
}
