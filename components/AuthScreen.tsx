// components/AuthScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  DimensionValue,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Validation du mot de passe
const validatePassword = (password: string) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Au moins 8 caractères');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Une lettre minuscule');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Une lettre majuscule');
  }
  if (!/\d/.test(password)) {
    errors.push('Un chiffre');
  }
  
  return errors;
};

// Validation de l'email
const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Composant pour afficher les messages d'erreur
const ErrorMessage = ({ message, type = 'error' }: { message: string; type?: 'error' | 'warning' | 'info' }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const colors = {
    error: { bg: '#fee', border: '#FF3B30', text: '#c00', icon: 'close-circle' },
    warning: { bg: '#fff3cd', border: '#ffc107', text: '#856404', icon: 'warning' },
    info: { bg: '#e3f2fd', border: '#2196F3', text: '#1565c0', icon: 'information-circle' },
  };

  const style = colors[type];

  return (
    <Animated.View style={[styles.errorMessage, { 
      backgroundColor: style.bg, 
      borderColor: style.border,
      opacity: fadeAnim 
    }]}>
      <Ionicons name={style.icon as any} size={20} color={style.text} />
      <Text style={[styles.errorMessageText, { color: style.text }]}>{message}</Text>
    </Animated.View>
  );
};

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [registrationStep, setRegistrationStep] = useState<'form' | 'confirmation'>('form');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorType, setErrorType] = useState<'error' | 'warning' | 'info'>('error');

  const { signIn, signUp, signInAsGuest  } = useAuth();

  // Fonction pour afficher une erreur
  const showError = (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    setErrorMessage(message);
    setErrorType(type);
    // Auto-hide après 5 secondes
    setTimeout(() => {
      setErrorMessage('');
    }, 5000);
  };

  // Mode démo
  const handleDemoMode = async () => {
    setLoading(true);
    try {
      await signInAsGuest();
      console.log('✅ Mode démo activé');
    } catch (error: any) {
      console.error('❌ Erreur mode démo:', error);
      showError('Impossible de démarrer le mode démo');
    } finally {
      setLoading(false);
    }
  };

  // Gestion du rate limiting
  const handleRateLimit = () => {
    setRateLimited(true);
    setCountdown(30);
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setRateLimited(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Calculer la force du mot de passe
  const getPasswordStrength = (password: string) => {
    const errors = validatePassword(password);
    const strength = Math.max(0, 5 - errors.length);
    
    if (strength === 0) return { level: 'Très faible', color: '#FF3B30', width: '20%' as DimensionValue };
    if (strength === 1) return { level: 'Faible', color: '#FF9500', width: '40%' as DimensionValue };
    if (strength === 2) return { level: 'Moyen', color: '#FFCC00', width: '60%' as DimensionValue };
    if (strength === 3) return { level: 'Bon', color: '#30D158', width: '80%' as DimensionValue };
    if (strength >= 4) return { level: 'Excellent', color: '#34C759', width: '100%' as DimensionValue };
    
    return { level: 'Faible', color: '#FF9500', width: '40%' as DimensionValue };
  };

  const handleAuth = async () => {
    // Réinitialiser l'erreur
    setErrorMessage('');

    // Validation de base pour les champs vides
    if (!email.trim() && !password.trim()) {
      showError('Veuillez saisir votre email et votre mot de passe');
      return;
    }

    // Validation de l'email
    if (!email.trim()) {
      showError('Veuillez saisir votre adresse email');
      return;
    }

    if (!validateEmail(email.trim())) {
      showError('Veuillez saisir une adresse email valide');
      return;
    }

    // Validation du mot de passe
    if (!password.trim()) {
      showError('Veuillez saisir votre mot de passe');
      return;
    }

    if (isSignUp) {
      // Validation renforcée pour l'inscription
      const passwordErrors = validatePassword(password);
      if (passwordErrors.length > 0) {
        showError(`Votre mot de passe doit contenir :\n• ${passwordErrors.join('\n• ')}`);
        return;
      }

      if (password !== confirmPassword) {
        showError('Les mots de passe ne correspondent pas');
        return;
      }
    } else {
      // Pour la connexion, juste vérifier la longueur minimale
      if (password.length < 6) {
        showError('Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        console.log('📄 Tentative d\'inscription...', { email: email.trim() });
        
        const result = await signUp(email.trim(), password);
        console.log('📊 Résultat inscription:', result);
        
        if (result.error) {
          console.error('❌ Erreur inscription:', result.error);
          
          // Messages d'erreur personnalisés
          let errorMsg = result.error.message;
          if (result.error.message.includes('already registered')) {
            errorMsg = 'Cet email est déjà utilisé. Essayez de vous connecter.';
          } else if (result.error.message.includes('invalid email')) {
            errorMsg = 'Format d\'email invalide';
          } else if (result.error.message.includes('weak password')) {
            errorMsg = 'Mot de passe trop faible';
          } else if (result.error.message.includes('too many requests') || result.error.message.includes('rate limit')) {
            handleRateLimit();
            errorMsg = `Trop de tentatives rapides. Veuillez patienter ${countdown} secondes.`;
          }
          
          showError(errorMsg);
        } else {
          console.log('✅ Inscription réussie');
          // Passer à l'étape de confirmation
          setRegistrationStep('confirmation');
          setLoading(false);
          return; // Sortir ici pour ne pas continuer
        }
      } else {
        console.log('📄 Tentative de connexion...', { email: email.trim() });
        
        const result = await signIn(email.trim(), password);
        console.log('📊 Résultat connexion:', result);
        
        if (result.error) {
          console.error('❌ Erreur connexion:', result.error);
          
          // Messages d'erreur personnalisés
          let errorMsg = result.error.message;
          if (result.error.message.includes('Invalid login credentials')) {
            errorMsg = 'Email ou mot de passe incorrect. Vérifiez vos identifiants ou créez un compte.';
          } else if (result.error.message.includes('Email not confirmed')) {
            errorMsg = 'Veuillez confirmer votre email avant de vous connecter';
          } else if (result.error.message.includes('too many requests')) {
            handleRateLimit();
            errorMsg = `Trop de tentatives. Veuillez patienter ${countdown} secondes.`;
          } else if (result.error.message.includes('User not found') || result.error.message.includes('user not found')) {
            errorMsg = 'Ce compte n\'existe pas. Veuillez vous inscrire d\'abord.';
          } else {
            // Afficher l'erreur générique si non reconnue
            errorMsg = result.error.message || 'Erreur de connexion. Vérifiez vos identifiants.';
          }
          
          showError(errorMsg);
        } else {
          console.log('✅ Connexion réussie');
          // La navigation sera gérée automatiquement par AuthContext
        }
      }
    } catch (error: any) {
      console.error('💥 Erreur inattendue:', error);
      showError(error.message || 'Une erreur inattendue est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setRegistrationStep('form');
    setErrorMessage(''); // Reset error
  };

  const backToSignIn = () => {
    setIsSignUp(false);
    setPassword('');
    setConfirmPassword('');
    setRegistrationStep('form');
    setErrorMessage('');
  };

  const passwordStrength = isSignUp ? getPasswordStrength(password) : null;
  const passwordErrors = isSignUp ? validatePassword(password) : [];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>🧠</Text>
            <Text style={styles.title}>Synapse</Text>
            <Text style={styles.subtitle}>
              {registrationStep === 'confirmation' 
                ? 'Vérifiez votre email' 
                : isSignUp 
                  ? 'Créez votre compte' 
                  : 'Connectez-vous à votre compte'
              }
            </Text>
          </View>

          {/* Message d'erreur global */}
          {errorMessage ? (
            <ErrorMessage message={errorMessage} type={errorType} />
          ) : null}

          {/* Écran de confirmation d'inscription */}
          {registrationStep === 'confirmation' ? (
            <View style={styles.confirmationContainer}>
              <View style={styles.confirmationIcon}>
                <Ionicons name="mail" size={60} color="#007AFF" />
              </View>
              
              <Text style={styles.confirmationTitle}>
                Email de confirmation envoyé ! 📧
              </Text>
              
              <Text style={styles.confirmationText}>
                Nous avons envoyé un lien de confirmation à :
              </Text>
              
              <Text style={styles.confirmationEmail}>
                {email}
              </Text>
              
              <Text style={styles.confirmationInstructions}>
                Cliquez sur le lien dans l'email pour activer votre compte, puis revenez vous connecter.
              </Text>
              
              <View style={styles.confirmationTips}>
                <Text style={styles.tipsTitle}>💡 Si vous ne voyez pas l'email :</Text>
                <Text style={styles.tipsText}>
                  • Vérifiez votre dossier spam/indésirables{'\n'}
                  • Attendez quelques minutes{'\n'}
                  • Vérifiez que l'adresse email est correcte
                </Text>
              </View>
              
              <Pressable 
                style={styles.backToSignInButton} 
                onPress={backToSignIn}
              >
                <Text style={styles.backToSignInText}>
                  Retour à la connexion
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={[
                  styles.inputContainer,
                  emailFocused && styles.inputContainerFocused,
                  !validateEmail(email) && email.length > 0 && styles.inputError
                ]}>
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { outlineWidth: 0 }]}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="votre@email.com"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!loading}
                  />
                </View>
                {!validateEmail(email) && email.length > 0 && (
                  <Text style={styles.errorText}>Format d'email invalide</Text>
                )}
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mot de passe</Text>
                <View style={[
                  styles.inputContainer,
                  passwordFocused && styles.inputContainerFocused
                ]}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { outlineWidth: 0 }]}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder="Entrez votre mot de passe"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    editable={!loading}
                    onSubmitEditing={handleAuth}
                    returnKeyType="go"
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#666"
                    />
                  </Pressable>
                </View>
                
                {/* Indicateur de force du mot de passe pour l'inscription */}
                {isSignUp && password.length > 0 && passwordStrength && (
                  <View style={styles.passwordStrength}>
                    <View style={styles.strengthBar}>
                      <View 
                        style={[
                          styles.strengthFill,
                          { 
                            width: passwordStrength.width,
                            backgroundColor: passwordStrength.color
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                      {passwordStrength.level}
                    </Text>
                  </View>
                )}
                
                {/* Exigences du mot de passe */}
                {isSignUp && password.length > 0 && passwordErrors.length > 0 && (
                  <View style={styles.passwordRequirements}>
                    <Text style={styles.requirementsTitle}>Votre mot de passe doit contenir :</Text>
                    {passwordErrors.map((error, index) => (
                      <Text key={index} style={styles.requirementItem}>• {error}</Text>
                    ))}
                  </View>
                )}
              </View>

              {/* Confirm Password (only for sign up) */}
              {isSignUp && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirmer le mot de passe</Text>
                  <View style={[
                    styles.inputContainer,
                    confirmPasswordFocused && styles.inputContainerFocused,
                    confirmPassword.length > 0 && password !== confirmPassword && styles.inputError
                  ]}>
                    <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { outlineWidth: 0 }]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setConfirmPasswordFocused(true)}
                      onBlur={() => setConfirmPasswordFocused(false)}
                      placeholder="Confirmez votre mot de passe"
                      placeholderTextColor="#999"
                      secureTextEntry={!showConfirmPassword}
                      autoComplete="new-password"
                      editable={!loading}
                      onSubmitEditing={handleAuth}
                      returnKeyType="go"
                    />
                    <Pressable
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="#666"
                      />
                    </Pressable>
                  </View>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <Text style={styles.errorText}>Les mots de passe ne correspondent pas</Text>
                  )}
                </View>
              )}

              {/* Submit Button */}
              <Pressable
                style={[
                  styles.submitButton, 
                  (loading || rateLimited || (isSignUp && passwordErrors.length > 0) || !email.trim() || !password.trim()) && styles.submitButtonDisabled
                ]}
                onPress={handleAuth}
                disabled={loading || rateLimited || (isSignUp && passwordErrors.length > 0) || !email.trim() || !password.trim()}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.loadingText}>
                      {isSignUp ? 'Inscription...' : 'Connexion...'}
                    </Text>
                  </View>
                ) : rateLimited ? (
                  <Text style={styles.submitButtonText}>
                    Veuillez patienter {countdown}s
                  </Text>
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isSignUp ? 'S\'inscrire' : 'Se connecter'}
                  </Text>
                )}
              </Pressable>

              {/* Toggle Mode */}
              <Pressable style={styles.toggleButton} onPress={toggleMode} disabled={loading}>
                <Text style={styles.toggleText}>
                  {isSignUp
                    ? 'Vous avez déjà un compte ? '
                    : 'Vous n\'avez pas de compte ? '}
                  <Text style={styles.toggleLink}>
                    {isSignUp ? 'Se connecter' : 'S\'inscrire'}
                  </Text>
                </Text>
              </Pressable>
            </View>
          )}

          {/* Security Info pour l'inscription */}
          {isSignUp && registrationStep === 'form' && (
            <View style={styles.securityInfo}>
              <Text style={styles.securityTitle}>🔒 Sécurité</Text>
              <Text style={styles.securityText}>
                Nous utilisons un système de sécurité professionnel avec hachage bcrypt pour protéger vos informations. 
                Votre mot de passe est haché et jamais stocké en clair.
              </Text>
            </View>
          )}

          {/* Bouton Mode Démo */}
          {!isSignUp && registrationStep === 'form' && (
            <View style={styles.demoSection}>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>
              
              <Pressable
                style={styles.demoButton}
                onPress={handleDemoMode}
                disabled={loading}
              >
                <Ionicons name="play-circle-outline" size={24} color="#007AFF" />
                <Text style={styles.demoButtonText}>
                  Continuer en mode démo
                </Text>
              </Pressable>
              
              <Text style={styles.demoDescription}>
                Testez l'application sans créer de compte. Vos données resteront locales.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Style pour le message d'erreur
  errorMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 20,
    gap: 10,
  },
  errorMessageText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  form: {
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  inputContainerFocused: {
    borderColor: '#007AFF',
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 5,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 5,
  },
  passwordStrength: {
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 5,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  passwordRequirements: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 5,
  },
  requirementItem: {
    fontSize: 13,
    color: '#856404',
    marginBottom: 2,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 16,
    color: '#666',
  },
  toggleLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
  securityInfo: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c3e6c3',
    marginBottom: 20,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d5016',
    marginBottom: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#2d5016',
    lineHeight: 20,
  },// Styles pour le mode démo
demoSection: {
  marginTop: 30,
},
divider: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 20,
},
dividerLine: {
  flex: 1,
  height: 1,
  backgroundColor: '#ddd',
},
dividerText: {
  marginHorizontal: 15,
  fontSize: 14,
  color: '#999',
  fontWeight: '500',
},
demoButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#fff',
  paddingVertical: 16,
  paddingHorizontal: 20,
  borderRadius: 12,
  borderWidth: 2,
  borderColor: '#007AFF',
  gap: 10,
  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 1,
  },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
},
demoButtonText: {
  color: '#007AFF',
  fontSize: 18,
  fontWeight: '600',
},
demoDescription: {
  fontSize: 13,
  color: '#666',
  textAlign: 'center',
  marginTop: 10,
  paddingHorizontal: 20,
  lineHeight: 18,
},
  // Styles pour l'écran de confirmation
  confirmationContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmationIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmationText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmationEmail: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
  },
  confirmationInstructions: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  confirmationTips: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    marginBottom: 30,
    width: '100%',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  backToSignInButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backToSignInText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});