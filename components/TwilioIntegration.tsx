import { useState } from 'react';
import { Alert, Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

/** Normalize any US phone string to E.164 (+1XXXXXXXXXX) required by Twilio. */
const toE164 = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone; // already E.164 or unrecognized — pass through
};

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export const useTwilioSMS = () => {
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  const sendSingleSMS = async (phone: string, message: string, name?: string, companyId?: string) => {
    const personalizedMessage = name ? message.replace('{name}', name.split(' ')[0]) : message;
    const e164Phone = toE164(phone);
    setIsSendingSMS(true);
    try {
      const res = await fetch(`${API_BASE}/api/twilio-send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: e164Phone, body: personalizedMessage, companyId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send SMS');
      if (result.success) {
        showAlert('Success', 'SMS sent successfully!');
        return true;
      }
      showAlert('Error', 'Failed to send SMS');
      return false;
    } catch (error: any) {
      console.error('SMS Error:', error);
      showAlert('Error', error.message || 'Failed to send SMS');
      return false;
    } finally {
      setIsSendingSMS(false);
    }
  };

  const sendBulkSMSMessages = async (
    recipients: { phone: string; name: string }[],
    message: string,
    companyId?: string
  ) => {
    // Normalize all phone numbers to E.164 before sending
    const normalizedRecipients = recipients.map(r => ({ ...r, phone: toE164(r.phone) }));
    setIsSendingBulk(true);
    try {
      const res = await fetch(`${API_BASE}/api/twilio-send-bulk-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: normalizedRecipients, body: message, companyId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send bulk SMS');
      if (result.success) {
        showAlert(
          'Success',
          `SMS sent to ${result.totalSent} recipient${result.totalSent !== 1 ? 's' : ''}.${result.totalFailed > 0 ? ` ${result.totalFailed} failed.` : ''}`
        );
        return result;
      }
      showAlert('Error', 'Failed to send bulk SMS');
      return null;
    } catch (error: any) {
      console.error('Bulk SMS Error:', error);
      showAlert('Error', error.message || 'Failed to send bulk SMS');
      return null;
    } finally {
      setIsSendingBulk(false);
    }
  };

  return {
    sendSingleSMS,
    sendBulkSMSMessages,
    isLoading: isSendingSMS || isSendingBulk,
  };
};

export const useTwilioCalls = () => {
  const [isLoadingCall, setIsLoadingCall] = useState(false);

  const initiateCall = async (phone: string, message?: string) => {
    setIsLoadingCall(true);
    try {
      const res = await fetch(`${API_BASE}/api/twilio-make-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message: message || 'Hello, this is a call from Legacy Prime Construction.' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to initiate call');
      if (result.success) {
        showAlert('Success', 'Call initiated successfully!');
        return true;
      }
      showAlert('Error', 'Failed to initiate call');
      return false;
    } catch (error: any) {
      console.error('Call Error:', error);
      showAlert('Error', error.message || 'Failed to initiate call');
      return false;
    } finally {
      setIsLoadingCall(false);
    }
  };

  return {
    initiateCall,
    callLogs: [],
    isLoadingCallLogs: false,
    isLoadingCall,
    refetchCallLogs: () => {},
  };
};

export const useTwilioVirtualAssistant = () => {
  const [isLoading, setIsLoading] = useState(false);

  const setupVirtualAssistant = async (
    businessName: string,
    greeting: string,
    webhookUrl: string
  ) => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
      const res = await fetch(`${apiUrl}/api/twilio-create-virtual-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, greeting, webhookUrl }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to setup virtual assistant');
      if (result.success) {
        Alert.alert('Success', 'Virtual assistant configured successfully!');
        return result.twiml;
      }
      Alert.alert('Error', 'Failed to setup virtual assistant');
      return null;
    } catch (error: any) {
      console.error('Virtual Assistant Error:', error);
      Alert.alert('Error', error.message || 'Failed to setup virtual assistant');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    setupVirtualAssistant,
    isLoading,
  };
};
