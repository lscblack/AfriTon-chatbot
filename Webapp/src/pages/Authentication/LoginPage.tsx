import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, PieChart, Shield, Zap } from 'lucide-react';
import DragCaptcha from '../../components/SharedComp/auth/DragCaptcha';
import { loginAll } from '../../app/Localstorage';
import mainAxios from '../../Instance/mainAxios';
import Typewriter from 'typewriter-effect';
// Type definitions
interface LoginFormData {
    email: string;
    password: string;
}

interface LoginErrors {
    email?: string;
    password?: string;
    general?: string;
}

interface LoginResponse {
    success: boolean;
    message?: string;
    user?: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    UserInfo?: {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        userType: string;
    };
}

interface FeatureCard {
    icon: React.ComponentType<any>;
    title: string;
    desc: string;
}

const LoginPage: React.FC = () => {
    const [isVerified, setIsVerified] = useState(false);
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [formData, setFormData] = useState<LoginFormData>({
        email: '',
        password: ''
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<LoginErrors>({});
    const [rememberMe, setRememberMe] = useState<boolean>(false);

    const validateForm = (): boolean => {
        const newErrors: LoginErrors = {};

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error when user starts typing
        if (errors[name as keyof LoginErrors]) {
            setErrors(prev => ({
                ...prev,
                [name]: undefined
            }));
        }
    };

    const handleLogin = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setErrors({});

        try {
            // Use mainAxios to call your backend
            const response = await mainAxios.post<LoginResponse>('/auth/login', {
                email: formData.email,
                password: formData.password
            });

            if (response.data && response.data.access_token) {
                // Store tokens and user info
                const { access_token, refresh_token, UserInfo } = response.data;

                // Store tokens in localStorage or your preferred storage
                localStorage.setItem('access_token', access_token);
                if (refresh_token) {
                    localStorage.setItem('refresh_token', refresh_token);
                }

                // Store user info
                if (UserInfo) {
                    localStorage.setItem('userInfo', JSON.stringify(UserInfo));
                }

                // Save to localStorage if "Remember me" is checked
                if (rememberMe) {
                    sessionStorage.setItem('userInfo', JSON.stringify(UserInfo));
                } else {
                    localStorage.removeItem('userInfo');
                }

                // Call your existing login function
                loginAll(access_token, refresh_token || '', UserInfo || {}, rememberMe);

                // Redirect or reload
                window.location.href = "/admin-dashboard";
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error: any) {
            console.error('Login error:', error);

            let errorMessage = 'Login failed. Please try again.';

            if (error.response) {
                // Backend returned an error response
                const backendError = error.response.data;
                errorMessage = backendError.detail || backendError.message || errorMessage;

                // Handle specific HTTP status codes
                if (error.response.status === 401) {
                    errorMessage = 'Invalid email or password';
                } else if (error.response.status === 500) {
                    errorMessage = 'Server error. Please try again later.';
                }
            } else if (error.request) {
                // Request was made but no response received
                errorMessage = 'Unable to connect to server. Please check your connection.';
            }

            setErrors({ general: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = (): void => {
        // Simulate forgot password functionality
        alert('Password reset instructions will be sent to your email if it exists in our system.');
    };

    const handleContactAdmin = (): void => {
        // Simulate contact admin functionality
        alert('Please contact your system administrator to create an account.');
    };

    const features: FeatureCard[] = [
        { icon: PieChart, title: 'Analytics', desc: 'Real-time insights' },
        { icon: Shield, title: 'Secure', desc: 'Bank-level security' },
        { icon: Zap, title: 'Fast', desc: 'Lightning quick' }
    ];

    // Check for remembered email on component mount
    React.useEffect(() => {
        const rememberedEmail = localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo') || '{}').email : '';
        if (rememberedEmail) {
            setFormData(prev => ({ ...prev, email: rememberedEmail }));
            setRememberMe(true);
        }
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center p-4">
            {/* Background animated elements */}
            <div className="absolute inset-0 overflow-hidden">
                <motion.div
                    animate={{
                        x: [0, 100, 0],
                        y: [0, -100, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        repeatType: "reverse"
                    }}
                    className="absolute top-10 left-10 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70"
                />
                <motion.div
                    animate={{
                        x: [0, -100, 0],
                        y: [0, 100, 0],
                    }}
                    transition={{
                        duration: 18,
                        repeat: Infinity,
                        repeatType: "reverse"
                    }}
                    className="absolute top-40 right-10 w-72 h-72 bg-orange-100 rounded-full mix-blend-multiply filter blur-xl opacity-70"
                />
                <motion.div
                    animate={{
                        x: [0, 50, 0],
                        y: [0, -50, 0],
                    }}
                    transition={{
                        duration: 16,
                        repeat: Infinity,
                        repeatType: "reverse"
                    }}
                    className="absolute bottom-10 left-1/2 w-72 h-72 bg-purple-100 rounded-full mix-blend-multiply filter blur-xl opacity-70"
                />
            </div>
            <div className="relative z-10 w-full md:max-w-11/12 flex flex-col lg:flex-row items-center justify-center gap-12">
                {/* Left side - Branding and Features */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    className="flex-1 text-center lg:text-left max-w-lg"
                >
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="mb-8"
                    >
                        <div className="flex items-center justify-center lg:justify-start mb-6">
                            <div>
                                <div className="md:h-15 w-30 max-md:m-auto overflow-hidden">
                                    <img src='Centerpiece.png' className='w-full h-full' />
                                </div>
                                <p className="text-lg text-secondary">
                                    CENTERPIECE GROUP LTD
                                </p>
                            </div>
                        </div>

                        <motion.h2
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.6 }}
                            className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-4"
                        >
                            <h1 className="text-4xl font-bold leading-tight text-gray-900">
                                Manage Your Finances{" "}
                                <span className="block text-2xl" style={{ color: '#f8ae1f' }}>
                                    <Typewriter
                                        options={{
                                            strings: [
                                                "Automate Payments Seamlessly.",
                                                "Track Expenses in Real Time.",
                                                "Monitor Revenue and Cash Flow.",
                                                "Manage Events and Financial Activities.",
                                                "Generate Accurate Financial Reports.",
                                                "Empower Smart Decision-Making.",
                                                "Integrate Teams and Transactions.",
                                                "Simplify Finance with Centerpiece.",
                                            ],
                                            autoStart: true,
                                            loop: true,
                                            delay: 70,
                                            deleteSpeed: 50,
                                        }}
                                    />
                                </span>
                            </h1>

                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.6 }}
                            className="text-sm md:text-lg text-gray-600 mb-8"
                        >
                            Streamline your financial operations with our comprehensive management system designed for events, earnings, and expenditures.
                        </motion.p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7, duration: 0.6 }}
                        className="grid grid-cols-3 sm:grid-cols-3 gap-6"
                    >
                        {features.map((feature, index) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 + index * 0.1, duration: 0.6 }}
                                className="text-center p-4"
                            >
                                <div className="w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center bg-primary">
                                    <feature.icon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="font-semibold text-gray-800 mb-1">{feature.title}</h3>
                                <p className="text-sm text-gray-600 hidden md:block">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>

                </motion.div>
                <div>
                    <div className='text-center delius-regular text-xl font-bolder text-primary mb-3 '>
                        <Typewriter
                            options={{
                                strings: ['EL-Shaddai God Most Higt', 'We Lift Your Holy Name'],
                                autoStart: true,
                                loop: true,
                                delay: 50,
                                deleteSpeed: 20,
                            }}
                        />
                    </div>
                    {!isVerified ?
                        < motion.div
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                            className="flex-0 max-w-lg md:w-md"
                        >
                            <DragCaptcha
                                onVerify={setIsVerified}
                            />
                        </motion.div>
                        :
                        <>
                            {/* Right side - Login Form */}
                            < motion.div
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.8 }}
                                className="flex-1 max-w-lg md:w-md xl:w-lg "
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, duration: 0.6 }}
                                    className="bg-white/80 backdrop-blur-lg rounded-2xl p-8"
                                >
                                    <div className="text-center mb-8">
                                        <motion.h3
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.4, duration: 0.6 }}
                                            className="text-xl font-bold text-gray-800 mb-2"
                                        >
                                            Welcome Back
                                        </motion.h3>
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.5, duration: 0.6 }}
                                            className="text-gray-600"
                                        >
                                            Sign in to access your dashboard
                                        </motion.p>
                                    </div>

                                    {errors.general && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm"
                                        >
                                            {errors.general}
                                        </motion.div>
                                    )}

                                    <form onSubmit={handleLogin} className="space-y-6 text-xs">
                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.6, duration: 0.6 }}
                                        >
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Email Address
                                            </label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    className={`w-full pl-10 pr-4 py-5 rounded-lg bg-gray-50 transition-all duration-200 focus:bg-white focus:outline-none focus:ring-2 ${errors.email ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200'
                                                        }`}
                                                    placeholder="Enter your email"
                                                    disabled={isLoading}
                                                />
                                            </div>
                                            {errors.email && (
                                                <motion.p
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="text-red-500 text-sm mt-1"
                                                >
                                                    {errors.email}
                                                </motion.p>
                                            )}
                                        </motion.div>

                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.7, duration: 0.6 }}
                                        >
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Password
                                            </label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={handleInputChange}
                                                    className={`w-full pl-10 pr-12 py-5 rounded-lg bg-gray-50 transition-all duration-200 focus:bg-white focus:outline-none focus:ring-2 ${errors.password ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200'
                                                        }`}
                                                    placeholder="Enter your password"
                                                    disabled={isLoading}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                                    disabled={isLoading}
                                                >
                                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                            {errors.password && (
                                                <motion.p
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="text-red-500 text-sm mt-1"
                                                >
                                                    {errors.password}
                                                </motion.p>
                                            )}
                                        </motion.div>

                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.8, duration: 0.6 }}
                                            className="flex items-center justify-between"
                                        >
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={rememberMe}
                                                    onChange={(e) => setRememberMe(e.target.checked)}
                                                    className="rounded text-blue-600 focus:ring-blue-200"
                                                    disabled={isLoading}
                                                />
                                                <span className="ml-2 text-sm text-gray-600">Remember me</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleForgotPassword}
                                                className="text-sm hover:underline transition-all"
                                                style={{ color: '#184478' }}
                                                disabled={isLoading}
                                            >
                                                Forgot password?
                                            </button>
                                        </motion.div>

                                        <motion.button
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.9, duration: 0.6 }}
                                            type="submit"
                                            disabled={isLoading}
                                            className={`${isLoading ? 'bg-secondary' : 'bg-primary'} w-full py-3 px-4 rounded-lg text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed`}

                                        >
                                            {isLoading ? (
                                                <>
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                                    />
                                                    Signing in...
                                                </>
                                            ) : (
                                                <>
                                                    Sign In
                                                    <ArrowRight className="w-5 h-5" />
                                                </>
                                            )}
                                        </motion.button>
                                    </form>

                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1, duration: 0.6 }}
                                        className="mt-6 text-center"
                                    >
                                        <p className="text-sm text-gray-600">
                                            Don't have an account?{' '}
                                            <button
                                                onClick={handleContactAdmin}
                                                className="font-medium hover:underline transition-all"
                                                style={{ color: '#f8ae1f' }}
                                                disabled={isLoading}
                                            >
                                                Contact Administrator
                                            </button>
                                        </p>
                                    </motion.div>
                                </motion.div>
                            </motion.div>
                        </>
                    }
                </div>
            </div>
        </div >
    );
};

export default LoginPage;